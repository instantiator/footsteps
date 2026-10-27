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

## Permission

A game that enables camera mode anywhere needs the camera permission before it starts. Its landing
page scans the game data, asks the browser for the permission, and shows a Grant button until it is
granted. New game and Continue stay disabled until then. See [Playing a game](game-play.md#permissions)
for the full flow.

A direct visit to `/game/:id/play` repeats the check and returns to the landing page when the
permission is anything but granted. A grant made on the landing page in the same tab counts, even
when the browser cannot report it. If the camera still fails to start in play (for example because
another app is using it), the game carries on without it, playable by clicks.

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

1. `CharacterCamera` asks for the webcam (1280×720 by default) with `navigator.mediaDevices.getUserMedia`, puts
   the stream in a `<video>`, and shares the video and stream with the rest of the layout.
2. `CharacterCanvas` creates the configured vision model with `createVisionModel` (see
   [configuration](#configuration)), once while there is a stream. By default this is BodyPix MobileNetV1 on
   WebGPU, run in a web worker. Every model implements `FootstepsVisionModelImplementation` (`src/vision/`).
3. Once per new camera frame (`requestVideoFrameCallback`), the model returns a `VisionFrame`: for each person, a
   silhouette mask and key points for their hands, feet and head. As soon as it returns, it is given the next
   frame, and the frame it returned is reported and drawn while it works. A `PersonTracker` keeps each person's id
   stable between frames and smooths their key points. It also holds someone the model loses for a moment where
   they were, then fades them out, so the silhouette doesn't flicker ([ADR 0007](ADRs/0007-camera-flicker.md)).
4. `drawPeople` (`DrawPeople.ts`) draws the video onto a canvas and keeps only the people, with their edges
   blurred by `cameraFeatherPx`. `binary` keeps the players' own colours; `colored` tints each person and their head, hands and feet; `extremities` tints only
   the hands and feet.
5. The canvas is mirrored with a CSS transform, so the player's left is their left on screen. The masks are in
   the camera's own (unmirrored) orientation.
6. When the stream goes away, the model is disposed and the loop is cancelled. Starting a new stream loads a
   fresh model.

## Configuration

Camera and vision settings are app config: set per environment in the committed `.env` files (`.env`, then
`.env.development`, `.env.test` or `.env.production`), or for one visit by a URL query named after the setting.
An untracked `.env.local` holds personal overrides. `src/config/AppConfig.ts` documents every setting.

| Setting (`.env` / query)                           | Default                             | What it does                                                           |
| -------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `VITE_DEBUG` / `debug`                             | `false`                             | Debugging aids; see [debugging](#debugging)                            |
| `VITE_SHOW_FPS` / `showFps`                        | on in development, off in the build | The camera tracking's frame rate in the HUD, while a camera is tracked |
| `VITE_VISION_MODEL` / `visionModel`                | `bodypix`                           | `bodypix`, `mediapipe` or `movenet`; see ADR 0005                      |
| `VITE_VISION_BACKEND` / `visionBackend`            | `webgpu`                            | tfjs backend for BodyPix and MoveNet; WebGPU falls back to WebGL       |
| `VITE_VISION_WORKER` / `visionWorker`              | `true`                              | Runs the model in a web worker                                         |
| `VITE_VISION_MAX_PEOPLE` / `visionMaxPeople`       | `4`                                 | The most players a model looks for                                     |
| `VITE_VISION_SMOOTHING` / `visionSmoothing`        | `true`                              | Stable player ids, smoothed key points, and the stable-frames rule     |
| `VITE_VISION_STABLE_FRAMES` / `visionStableFrames` | `2`                                 | Frames an interaction must hold before it fires                        |
| `VITE_CAMERA_WIDTH`, `VITE_CAMERA_HEIGHT`          | `1280`, `720`                       | The camera resolution asked for                                        |
| `VITE_VISION_INPUT_WIDTH` / `visionInputWidth`     | `960`                               | The widest frame the model is given; `0` gives it full size            |
| `VITE_BODYPIX_REFINE_STEPS` / `bodypixRefineSteps` | `3`                                 | Passes BodyPix makes to assign pixels to people                        |
| `VITE_BODYPIX_*` / `bodypix*`                      | MobileNetV1                         | Architecture, output stride, weight bytes, resolution, and threshold   |
| `VITE_MEDIAPIPE_VARIANT` / `mediapipeVariant`      | `full`                              | MediaPipe Pose's model size: `lite`, `full` or `heavy`                 |
| `VITE_CAMERA_FEATHER_PX` / `cameraFeatherPx`       | `3`                                 | How far the silhouette's edges fade out, in canvas pixels; `0` is hard |
| `VITE_CAMERA_HOLD_MS` / `cameraHoldMs`             | `400`                               | How long a player the model loses is still shown (needs smoothing)     |
| `VITE_CAMERA_FADE_MS` / `cameraFadeMs`             | `300`                               | How long a held player then takes to fade out                          |
| `VITE_CAMERA_FILL_GAPS` / `cameraFillGaps`         | `false`                             | Fills parts the model missed for a frame from the frame before         |
| `VITE_JUMP_*` / `jump*`                            | see [jumps](#jumps)                 | What counts as a jump                                                  |

For example, `?visionModel=mediapipe&visionWorker=false` tries MediaPipe Pose on the main thread. An invalid
value is ignored with a console warning. [ADR 0004](ADRs/0004-vision-optimisations.md) and
[ADR 0005](ADRs/0005-vision-models.md) explain the choices and measurements.

## How interactions work

Camera interactions fire display [rules](game-data.md#rules-and-state) whose trigger is an `interact`:

```json
{
  "on": { "interact": ["click", "hand"], "target": "#stages-link-stage-1", "threshold": 0.5 },
  "do": [{ "enterStage": "stage-1" }]
}
```

The trigger names the elements (any CSS selector), which interactions it accepts, and how much of the body part
must be inside an element. `threshold` defaults to `1`. Any display that is showing can have them, including a
stage's shared display and its challenges.

| Interaction   | Detected from                                       |
| ------------- | --------------------------------------------------- |
| `click`       | A mouse click, or Enter/Space on a focused element  |
| `mouse-enter` | The mouse moving onto the element (not the camera)  |
| `mouse-exit`  | The mouse moving off the element (not the camera)   |
| `hand`        | Either hand                                         |
| `foot`        | Either foot                                         |
| `head`        | The head                                            |
| `body`        | The whole silhouette                                |
| `any`         | Any single body part, or the whole silhouette       |
| `jump`        | A jump that takes off from and lands on the element |
| `jump-from`   | A jump that takes off from the element              |
| `jump-onto`   | A jump that lands on the element                    |

A **body part** is a region of the player's silhouette. A hand or foot is a disc around its key point, scaled to
the player's head; the head is the box its top, bottom and sides span; the body is the whole silhouette. A
**threshold** is the fraction of a body part that must be inside the element's rectangle: `inside pixels / total
pixels of that part`. It is clamped to 0–1. The default, `1`, needs the whole part inside; `0` only needs one
pixel. `hand`, `foot` and `any` fire when any one of their parts meets the threshold.

Interactions are **edge-triggered**: one fires when the player has met the condition for
`visionStableFrames` frames in a row (2 by default, so a one-frame flicker doesn't count), not on every frame
they hold it. Moving away re-arms it, so a second approach fires again. A player who already
meets the condition when their monitor starts (when camera mode starts, after a display change, or on
coming back into view) must move away and back first.

### Jumps

A **jump** is measured by how far the lower foot moves, as a fraction of the player's height (from their feet to the
top of their head), so near and far players, children and adults, jump alike. Sideways motion is ignored. All three
jump interactions fire as the player lands, on the elements their feet were on when they took off and when they
landed.

1. The feet stand still (within `jumpStill`) for at least `jumpMinGroundedMs`.
2. They rise at least `jumpMinRise` above where they stood. That is the take-off.
3. They come back down at least `jumpMinDescent` of the rise, within `jumpMaxAirtimeMs` of leaving the ground. That
   is the landing. A frame where the model loses the feet in the air is skipped.
4. A rise still going after `jumpMaxRiseMs`, or a jump that doesn't land in time, is abandoned. Wherever the feet
   are then is the ground. This is how stepping back, which raises the feet in the image, is told from a jump.

| Setting (`.env` / query)                          | Default | What it does                                      |
| ------------------------------------------------- | ------- | ------------------------------------------------- |
| `VITE_JUMP_MIN_RISE` / `jumpMinRise`              | `0.04`  | The rise needed (about 5 cm for a 1.3 m child)    |
| `VITE_JUMP_STILL` / `jumpStill`                   | `0.02`  | How far standing feet may wander                  |
| `VITE_JUMP_MIN_GROUNDED_MS` / `jumpMinGroundedMs` | `100`   | How long the feet must stand before a take-off    |
| `VITE_JUMP_MAX_RISE_MS` / `jumpMaxRiseMs`         | `500`   | The longest the feet may keep rising              |
| `VITE_JUMP_MAX_AIRTIME_MS` / `jumpMaxAirtimeMs`   | `1000`  | The longest from leaving the ground to landing    |
| `VITE_JUMP_MIN_DESCENT` / `jumpMinDescent`        | `0.5`   | How much of the rise the feet must come back down |

[ADR 0008](ADRs/0008-jump-detection.md) explains the model and how the defaults were chosen.

Clicks remain the keyboard-accessible route. A camera interaction fires the same rule a click would, through
`useGameRules` (`src/components/core/GameRulesHook.ts`), so `enterStage` still ignores locked and completed stages.

An element only counts where it is the **topmost** thing under the body part, as a click would find it: an
element covered by another doesn't respond, unless the rule sets `"includeCovered": true`. The check is one
`document.elementFromPoint` per body part and element, at the centre of where the part overlaps the element, and
only once the threshold is met, so it stays cheap every frame. The silhouette, the camera preview and the debug
overlay take no pointer events, so they never count as covering.

While a display or camera transition is running, clicks and camera interactions are ignored. The
scene is `inert`, the monitors are cleared, and the camera hook drops frames. The fresh monitors
ignore whatever holds on their first frame, so a held hand cannot fire as the new display arrives.

### From frame to event

`CharacterCanvas` calls `onPlayersChange` once per frame with every player's mask, key points and feet,
and the frame's timestamp. Each frame, `usePlayerInteractions` runs every camera rule's selector inside its
display's templates (found by `data-display-scope`), so elements can appear, move and disappear between frames. It
builds a mask-space rectangle for each element, keeps one `PlayerMonitor` per player, and passes the monitors'
events to `useGameRules`. The rectangle conversion mirrors the x axis to match the canvas, and
`screenPointForMaskPoint` maps back for the covering check.

The monitors remember each element by a key: its `id`, or a key generated for an element without one (held in a
`WeakMap`, so it goes with the element). An element without an `id` that a re-render replaces gets a new key, and
counts as new, so give an `id` to elements whose interactions should carry over.

## Debugging

Add `?debug=true` to the URL to turn on the `debug` setting. In camera mode that:

- tints each player differently, with their head, hands and feet in their own colours;
- shows a colour key under the preview;
- shows the frame rate, the time each step takes (inference, tracking, monitors, drawing), and the people, hands and
  feet found, over the silhouette (`showFps` shows this too);
- draws a green dot where each person's feet were found.

Lower a rule's `threshold` when testing interactions, and use the feet dots to see where the
camera thinks the player is. Changing the debug setting restarts the tracking loop with the new
mask type, and cancels the old one; check the console for model or "disposed" errors after
toggling it.

## Where the code lives

| Path                                                  | What it does                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/config/AppConfig.ts`                             | the settings, their defaults, and reading them from `.env` and the URL            |
| `src/components/camera/CharacterCamera.tsx`           | webcam stream and the preview video                                               |
| `src/components/camera/CharacterCanvas.tsx`           | tracking loop; draws the silhouettes; reports players and feet; the stats readout |
| `src/components/camera/DrawPeople.ts`                 | cuts the people out of the video, and tints them for debugging                    |
| `src/components/camera/PlayerMonitor.ts`              | turns body-part coverage and feet into edge-triggered interactions                |
| `src/components/camera/JumpDetector.ts`               | follows a player's feet for jumps                                                 |
| `src/components/camera/CameraSupport.ts`              | camera request, feet position, and screen-to-mask rectangles                      |
| `src/components/camera/FrameStats.ts`                 | frame rate, inference time, and what each frame found                             |
| `src/components/camera/CameraDebugOverlay.tsx`        | green feet markers                                                                |
| `src/vision/FootstepsVisionModelImplementation.ts`    | the base class every vision model implements, with the body-part queries          |
| `src/vision/BodyPart.ts`, `VisionTypes.ts`            | our body parts, and the frames models return                                      |
| `src/vision/VisionQueries.ts`                         | body parts at a point or in an area; splitting one silhouette between people      |
| `src/vision/Tracking.ts`                              | stable player ids, key-point smoothing, holding lost players, and filling gaps    |
| `src/vision/models/`                                  | BodyPix, MediaPipe Pose and MoveNet, and the tfjs backend choice                  |
| `src/vision/VisionWorkerProxy.ts`, `vision.worker.ts` | runs a model in a web worker                                                      |
| `src/components/core/logic/CameraModeUtils.ts`        | per-display camera resolution                                                     |
| `src/components/core/logic/GameClickUtils.ts`         | targets, and the state changes for clicks and interactions                        |
| `src/components/core/layout/GameLayersLayout.tsx`     | the layer stack, scene transitions, shared camera state, and the interaction hook |
| `src/components/core/layout/useSceneTransition.ts`    | fades display changes and times the camera reshape and reduced motion             |
| `src/components/core/layout/PlayerInteractionHook.ts` | one monitor per player, and mask-space target rectangles                          |
| `src/components/core/layout/GameLayerWrappers.tsx`    | one wrapper component per layer                                                   |

## Testing

Unit tests cover the camera resolution (`tests/CameraModeUtils.test.ts`), the monitor and its jump
interactions (`tests/PlayerMonitor.test.ts`), jump detection (`tests/JumpDetector.test.ts`), mask rectangles and feet (`tests/CameraSupport.test.ts`), the
tracking loop (`tests/CharacterCanvas.test.tsx`), the config (`tests/AppConfig*.test.ts*`), each vision
model and the worker proxy (`tests/*Model.test.ts`, `tests/VisionWorkerProxy.test.ts`), the body-part
queries and tracking (`tests/VisionQueries.test.ts`, `tests/Tracking.test.ts`), and the layout and game
wiring, including the display fades and camera reshape timings, waiting for a camera shape, and reduced
motion.

The browser suite runs the real vision pipeline in Chromium against a fake webcam. It samples the
viewport mid-reshape, waits for the new display to fade in, and checks that the fitted game view
contains every stepping stone:

```bash
npx playwright install chromium  # once
scripts/run-browser-tests.sh
```

It is local only, needs network access to download the model, and takes about 2–3 minutes on Apple
Silicon. The opt-in vision benchmark shows the fake webcam 25 photos of people and reports, for each, the frame
rate, inference time, and the people, hands and feet found:

```bash
VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench
VISION_BENCH=1 VISION_BENCH_QUERY="&visionModel=mediapipe" scripts/run-browser-tests.sh vision-bench
```

The fake webcam is 1280×720, like the real camera (`VISION_BENCH_CAMERA=640x480` changes it).
`VISION_BENCH_SHOTS=<folder>` also saves each scene's debug view, named `VISION_BENCH_LABEL-<scene>.png`. See [manual testing](testing/manual-testing.md) for what it proves, the
manual checks with a real camera, and how to debug a failure.
