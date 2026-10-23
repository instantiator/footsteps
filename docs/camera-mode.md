# Camera mode

Camera mode makes the player the game's character. A body-segmentation model cuts them out of the
webcam picture and layers their silhouette into the game's scenes, so they move through the artwork
as they move in front of the camera.

It is optional. A game can switch it on for the whole game, and any display can override it.

## Switching it on

For a whole game, add the camera module to its data:

```json
"modules": {
  "camera": { "enabled": true, "preview": true }
}
```

`preview` is optional and defaults to `true`. Set it to `false` to run the camera without showing the
small webcam preview.

Any display (overview, stage `shared`, or challenge) can override either setting:

```json
"camera": { "enabled": false, "preview": false }
```

Both fields are optional, so a display can change one without the other. The data shape is in
[game data](game-data.md#camera-settings).

Camera mode is resolved separately for each setting, most specific first:

1. If any active challenge sets it to `true`, it is on.
2. Otherwise, if any active challenge sets it to `false`, it is off.
3. Otherwise, the open stage's `shared` display decides.
4. Otherwise, the overview display decides.
5. Otherwise, the game's `modules.camera` decides.
6. Otherwise, camera mode is off and the preview is on.

The preview is always off while camera mode is off. The code is `resolveCameraMode` in
`src/components/core/logic/CameraModeUtils.ts`.

## What the player sees

- **Their own silhouette.** The player is cut out of the webcam picture and shown in the game,
  mirrored like a selfie camera. They are not a drawn character: everything that is not them is
  removed.
- **A small preview** in the top-right corner, also mirrored, so they can line themselves up.
  It can be hidden with `preview: false`.
- **The game's artwork** behind them, and a challenge's foreground in front of them.
- **The HUD** in the top-right: "Close challenge", "To title", and the fullscreen button.

An ordinary display change fades the old display out over 1s, swaps, then fades the new one in over
1s. When camera mode turns on or off, the game view instead eases between the container's shape and
the camera's over 2s; if the display changes too, it fades out over the final second of the reshape
and back in over 1s. With `prefers-reduced-motion: reduce`, every change is immediate.

The game waits for the webcam's shape before drawing the display layers, so the silhouette and the
artwork line up. If the player refuses the camera permission, the layers stay hidden and the error
is logged in the browser console.

## How the view is layered

The game is a stack of layers. A larger `zIndex` paints later, so it covers the smaller ones.
`GameLayersLayout` builds the stack and `GameLayerWrappers` makes each layer.

Without the camera, the stack fills the game container. With the camera, it is fitted to the
camera's aspect ratio and centred, so the whole game is inside what the camera can see. The
container's background shows in the space around it. The game view is a size container, so game
templates can use `cqw` and `cqh` to follow it; `vw` and `vh` still follow the browser window.

The display and camera layers sit inside one `.gameScene` wrapper, which fades as a whole; the HUD
sits outside it. For a camera change, `#game-viewport` animates its `aspect-ratio` with a 2s CSS
keyframe between the current shape and the camera's or container's shape, keeping the old display
visible until the swap.

| `zIndex` | Layer                 | What it holds                                           |
| -------- | --------------------- | ------------------------------------------------------- |
| 1        | overview background   | the title or stages artwork, behind everything          |
| 2        | overview foreground   | its clickable parts, still behind the player            |
| 3        | stage background      | the open stage's shared artwork                         |
| 4        | stage foreground      | its clickable parts, still behind the player            |
| 5        | challenge backgrounds | the active challenges, side by side                     |
| 6        | character silhouette  | the cut-out player (`CharacterCanvas`)                  |
| 7        | webcam preview        | the small mirrored video (`CharacterCamera`)            |
| 8        | challenge foregrounds | the only foregrounds drawn **in front of** the player   |
| 9        | debug overlay         | feet markers; only with `?debug=true` and the camera on |
| 10       | HUD                   | the application's buttons (`HeadsUpDisplay`)            |

Backgrounds sit behind the player, so they seem to stand inside the scene. A challenge's foreground
sits in front, which lets a game put a doorway over them, for example.

The layers ignore the mouse (`pointer-events: none`), including the silhouette, so clicks reach the
game's elements underneath. Each element's `id` says what a click or camera interaction does.

## How the silhouette is made

1. `CharacterCamera` asks for the webcam with `navigator.mediaDevices.getUserMedia`, puts the stream
   in a `<video>`, and shares the video and stream with the rest of the layout.
2. `CharacterCanvas` loads TensorFlow's BodyPix model with the ResNet50 backbone, once while there is
   a stream. It segments each video frame with the camera flipped to match the mirror.
3. For each person, it reads the mask once as image data. That mask gives both the pixels to draw and
   the person's feet position (`findFeet` in `CameraSupport`).
4. `drawMask` in `BodySegSupport` draws the video onto a canvas and keeps only the person-shaped
   part. `binary` keeps the player's own colours; `colored` and `extremities` tint the mask.
5. The canvas is mirrored with a CSS transform. The segmentation is flipped to match, so the player's
   left is their left on screen.
6. When the stream goes away, the model is disposed and the segmentation loop is cancelled. Starting
   a new stream loads a fresh model.

## How interactions work

An overview display's `clickIdToStageId` maps an element's `id` to a target:

```json
"clickIdToStageId": {
  "stages-link-stage-1": {
    "stage": "stage-1",
    "interactions": ["hand"],
    "threshold": 0.5
  }
}
```

A target names the stage an interaction enters, which interactions it accepts, and how much of the
body part must be inside the element. `interactions` defaults to `["click"]` and `threshold` to `1`.

| Interaction | Detected from                                      |
| ----------- | -------------------------------------------------- |
| `click`     | A mouse click, or Enter/Space on a focused element |
| `hand`      | Either hand                                        |
| `foot`      | Either foot                                        |
| `head`      | Either side of the face                            |
| `body`      | The whole silhouette                               |
| `any`       | Any single body part                               |
| `jump`      | The feet's vertical motion, in the sequence below  |

A **threshold** is the fraction of the chosen body part that must be inside the element's rectangle:
`inside pixels / total pixels of that part`. It is clamped to 0–1. The default, `1`, needs the whole
part inside; `0` only needs one pixel. `any` applies the threshold to each body part separately.

Interactions are **edge-triggered**: one fires when the player first meets the condition, not on
every frame they hold it. Moving away re-arms it, so a second approach fires again.

A **jump** is a short sequence, not a single frame:

1. With the feet inside the element and moving upward faster than `0.3` frame-heights per second, the
   sequence starts (`rising`).
2. Moving downward faster than `0.3` while inside makes it `falling`.
3. Coming to rest (speed `0.3` or less) while inside completes the jump and fires the interaction.
4. If 1.5 seconds pass first, the sequence is abandoned and returns to `ready`.

Leaving the element during the sequence does not reset it; the feet must come back inside for the
falling and resting steps.

Clicks keep working exactly as before, and remain the keyboard-accessible route. A camera
interaction is applied through the same state change as a click, and locked or completed stages are
still ignored; see `getNewGameStateForInteraction` in `GameClickUtils.ts`.

While a display or camera transition is running, clicks and camera interactions are ignored. The
scene is `inert`, the monitors are cleared, and the camera hook drops frames, so a held hand cannot
fire as the new display arrives.

### From frame to event

`CharacterCanvas` calls `onPlayersChange` once per frame with every player's mask and feet, and the
frame's timestamp. `usePlayerInteractions` builds a mask-space rectangle for each target element
that is on screen, keeps one `PlayerMonitor` per player, and turns the monitors' events into game
state changes in `Game`. The rectangle conversion mirrors the x axis to match the canvas.

Interactions are only available on **overview displays** today: `getInteractionTargets` returns the
overview's targets and an empty map while a stage is open.

## Debugging

Add `?debug=true` to the URL to turn on the `debug` feature flag. In camera mode that:

- tints the silhouette by body part;
- shows a colour key under the preview, with each part's mask value;
- draws a green dot where each person's feet were found.

Lower a target's `threshold` when testing interactions, and use the feet dots to see where the
camera thinks the player is. Changing the debug flag restarts the segmentation loop with the new
mask type, and cancels the old one; check the console for TensorFlow or "disposed" errors after
toggling it.

## Where the code lives

| Path                                                  | What it does                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/components/camera/CharacterCamera.tsx`           | webcam stream and the preview video                                               |
| `src/components/camera/CharacterCanvas.tsx`           | segmentation loop; draws the silhouette; reports players and feet                 |
| `src/components/camera/PlayerMonitor.ts`              | turns masks and feet into edge-triggered interactions                             |
| `src/components/camera/CameraSupport.ts`              | camera request, feet position, and screen-to-mask rectangles                      |
| `src/components/camera/BodySegSupport.ts`             | draws the mask, and the colours used for body parts                               |
| `src/components/camera/CameraDebugOverlay.tsx`        | green feet markers                                                                |
| `src/components/core/logic/CameraModeUtils.ts`        | per-display camera resolution                                                     |
| `src/components/core/logic/GameClickUtils.ts`         | targets, and the state changes for clicks and interactions                        |
| `src/components/core/layout/GameLayersLayout.tsx`     | the layer stack, scene transitions, shared camera state, and the interaction hook |
| `src/components/core/layout/useSceneTransition.ts`    | fades display changes and times the camera reshape and reduced motion             |
| `src/components/core/layout/PlayerInteractionHook.ts` | one monitor per player, and mask-space target rectangles                          |
| `src/components/core/layout/GameLayerWrappers.tsx`    | one wrapper component per layer                                                   |

## Testing

Unit tests cover the camera resolution (`tests/CameraModeUtils.test.ts`), the monitor and its jump
sequence (`tests/PlayerMonitor.test.ts`), mask rectangles (`tests/CameraSupport.test.ts`), the
segmentation loop (`tests/CharacterCanvas.test.tsx`), and the layout and game wiring, including the
display fades and camera reshape timings, waiting for a camera shape, and reduced motion.

The browser suite runs the real TensorFlow pipeline in Chromium against a fake webcam. It samples the
viewport mid-reshape, waits for the new display to fade in, and checks that the fitted game view
contains every stepping stone:

```bash
npx playwright install chromium  # once
scripts/run-browser-tests.sh
```

It is local only, needs network access on its first run to download the model, and takes about 3–4
minutes on Apple Silicon. See [manual testing](testing/manual-testing.md) for what it proves, the
manual checks with a real camera, and how to debug a failure.
