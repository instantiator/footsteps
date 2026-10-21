# Camera mode

Camera mode puts the player into the game. Rather than playing a character drawn by the game, the player sees their own body cut out of the webcam picture and layered into the game's scenes, moving as they move.

It is an optional module, switched on per game in that game's data:

```json
"modules": {
  "camera": { "enabled": true }
}
```

The setting is `GameData.modules.camera` (`CameraModuleData` in `src/entities/data/GameModuleData.ts`); see [game data](game-data.md#structure).

No bundled game turns it on yet. `magic-trifle` sets `"enabled": false`; `test-game` in `public/test-repository.json` sets it to `true`, but the app loads `public/game-repository.json`, so to try camera mode, set `"enabled": true` on magic-trifle and reload.

## What the player sees

- **A silhouette of themselves.** Their outline is cut out of the webcam picture and drawn into the game, mirrored left to right as in a mirror. It is not a drawing of a character: it is the player's own image, minus everything that isn't them.
- **A small webcam preview** in the top-right corner, also mirrored, so they can see what the camera sees and line themselves up.
- **The game's own artwork** behind and, for challenges, in front of the silhouette.
- **The HUD** (heads-up display: the buttons for "Close challenge" and "To title") in the top-right corner.

The silhouette is why the player appears inside the artwork without a green screen. A machine-learning model - **body segmentation**, from TensorFlow's BodyPix model - looks at each webcam frame and decides which pixels belong to a person. Only those pixels are kept. It runs once per frame, using the browser's `requestAnimationFrame`, so the silhouette keeps up as the player moves.

## How the view is layered

The screen is a stack of **layers**: full-screen boxes drawn one on top of another. Each layer's `zIndex` says when it is painted; a larger number paints later, so it covers the smaller ones. `GameLayersLayout` in `src/components/core/layout/GameLayersLayout.tsx` builds the stack, and `GameLayerWrappers.tsx` in the same directory makes each layer.

From back to front:

| `zIndex` | Layer                 | What it holds                                           |
| -------- | --------------------- | ------------------------------------------------------- |
| 1        | overview background   | the title / stages overview artwork, behind everything  |
| 2        | overview foreground   | its clickable parts, still behind the player            |
| 3        | stage background      | the open stage's shared artwork                         |
| 4        | stage foreground      | its clickable parts, still behind the player            |
| 5        | challenge backgrounds | the active challenges, side by side                     |
| 6        | character silhouette  | the cut-out player (`CharacterCanvas`)                  |
| 7        | webcam preview        | the small mirrored video (`CharacterCamera`)            |
| 8        | challenge foregrounds | the only foregrounds drawn **in front of** the player   |
| 9        | debug overlay         | feet markers; only with `?debug=true` and the camera on |
| 10       | HUD                   | the application's buttons (`HeadsUpDisplay`)            |

The ordering is the point of camera mode: backgrounds sit behind the player, so they seem to stand inside the scene, and a challenge can put a foreground over them, for example a doorway they step through.

A **display** is one screen of a game (a title, a stage, a challenge); each display renders into two layers, a background and a foreground. See [layers](game-data.md#layers).

Layers themselves ignore the mouse (`pointer-events: none`), so the silhouette never blocks anything. The elements inside a game's templates can still be clicked, and each element's `id` says what a click on it does.

## How the silhouette is made

1. `src/components/camera/CharacterCamera.tsx` asks the browser for the webcam with `navigator.mediaDevices.getUserMedia` (the browser API behind the camera permission prompt). It puts the stream in a `<video>` element, and hands that element and the stream up to `GameLayersLayout`, which shares them with the other camera components.
2. `src/components/camera/CharacterCanvas.tsx` loads the segmentation model once, then segments every video frame. `drawMask` in `BodySegSupport.ts` draws the video onto a `<canvas>` (a bitmap the code can paint on) and keeps only the person-shaped part of it.
3. The same component asks `findFeet` in `CameraSupport.ts` where the bottom of the silhouette is, in pixels and as a percentage of the frame. Today only the debug overlay uses those positions; they are groundwork for challenge interaction.
4. The canvas is mirrored with a CSS transform, so the player's left is their left on screen. The segmentation is flipped to match.

Two details worth knowing:

- **Waiting for the camera.** With camera mode on, the display layers are not drawn until the webcam reports its shape (`aspectRatio`: width divided by height). That lets the silhouette canvas match the video, so the layers line up. It also means that if the player refuses the permission prompt, the game stays blank apart from the HUD, and the error is logged in the browser console.
- **Releasing the camera.** When the game closes, `CharacterCamera` stops the webcam's tracks, which turns the camera off.

## Debugging

Add `?debug=true` to the page URL to turn on the `debug` feature flag (`src/providers/FeatureFlagsProvider.tsx`). In camera mode that:

- tints the silhouette by body part instead of leaving it as the player's own colours;
- shows a colour key under the preview, naming each part and its mask value;
- draws a green dot where each person's feet were found (`CameraDebugOverlay.tsx`).

## Where the code lives

| Path                                               | What it does                                                    |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `src/components/camera/CharacterCamera.tsx`        | webcam stream and the preview video                             |
| `src/components/camera/CharacterCanvas.tsx`        | segmentation loop; draws the silhouette; reports feet positions |
| `src/components/camera/CameraSupport.ts`           | camera request, feet position types, and `findFeet`             |
| `src/components/camera/BodySegSupport.ts`          | draws the mask, and the colours used for body parts             |
| `src/components/camera/CameraDebugOverlay.tsx`     | green feet markers                                              |
| `src/components/core/layout/GameLayersLayout.tsx`  | the layer stack, and the shared camera state                    |
| `src/components/core/layout/GameLayerWrappers.tsx` | one wrapper component per layer                                 |
