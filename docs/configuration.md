# Configuration

The app's settings live in `src/config/AppConfig.ts`, which documents each one and gives its default. They are set
per environment in `.env` files, and any of them can be overridden for one visit in the URL query.

## Where settings come from

Each layer overrides the one before it:

| Layer                             | Scope                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `DEFAULT_APP_CONFIG`              | The code's defaults, used for any setting nothing else gives                   |
| `.env`                            | Every environment                                                              |
| `.env.[mode]`                     | One mode: `development` (`npm run dev`), `test` (vitest), `production` (build) |
| `.env.local`, `.env.[mode].local` | Your own overrides; untracked                                                  |
| URL query                         | One visit, eg. `?debug=true&visionModel=mediapipe`                             |

The `.env` files are committed, and every `VITE_` value is visible in the built app, so they must hold no secrets.

The committed mode files change only these:

| File               | Sets                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `.env.development` | `VITE_SHOW_FPS=true`; the browser tests run against the dev server, so they get it too |
| `.env.test`        | `VITE_VISION_WORKER=false` (jsdom has no workers), `VITE_VISION_STABLE_FRAMES=1`       |

## Query parameters

A query parameter is the setting's camelCase name, and an `.env` variable is the same name in `VITE_` upper snake
case: `visionModel` is `VITE_VISION_MODEL`. Booleans are true for any value but `false`, so `?debug` alone turns
debugging on. An invalid value is ignored, with a console warning, and the layer below is used.

React Router re-reads the query when the URL changes, so a setting can be changed without reloading. See
[manual testing](testing/manual-testing.md#bug-16-the-segmentation-loop-keeps-running) for a console snippet.

## Settings

### General

| Query     | Default | Values  | What it does                                                                      |
| --------- | ------- | ------- | --------------------------------------------------------------------------------- |
| `debug`   | `false` | boolean | Debugging aids; see [camera mode debugging](camera-mode.md#debugging)             |
| `showFps` | `false` | boolean | The camera tracking's frame rate in the HUD, while a camera is tracked; on in dev |

### Vision

| Query                | Default   | Values                            | What it does                                                              |
| -------------------- | --------- | --------------------------------- | ------------------------------------------------------------------------- |
| `visionModel`        | `bodypix` | `bodypix`, `mediapipe`, `movenet` | The model that tracks players; see [ADR 0005](ADRs/0005-vision-models.md) |
| `visionBackend`      | `webgpu`  | `webgpu`, `webgl`                 | tfjs backend for BodyPix and MoveNet; WebGPU falls back to WebGL          |
| `visionWorker`       | `true`    | boolean                           | Runs the model in a web worker                                            |
| `visionMaxPeople`    | `4`       | whole number, 1 or more           | The most players a model looks for                                        |
| `visionSmoothing`    | `true`    | boolean                           | Stable player ids, smoothed key points, and the stable-frames rule        |
| `visionStableFrames` | `2`       | whole number, 1 or more           | Frames an interaction must hold before it fires                           |
| `visionInputWidth`   | `960`     | whole number                      | The widest frame the model is given; `0` gives it full size               |

### BodyPix

| Query                       | Default       | Values                          | What it does                                                              |
| --------------------------- | ------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `bodypixArchitecture`       | `MobileNetV1` | `MobileNetV1`, `ResNet50`       | The backbone: ResNet50 is more accurate, MobileNetV1 faster               |
| `bodypixOutputStride`       | `16`          | `8`, `16`, `32`                 | Smaller is finer and slower; ResNet50 has 16 and 32, MobileNetV1 8 and 16 |
| `bodypixQuantBytes`         | `2`           | `1`, `2`, `4`                   | Bytes per weight: fewer is smaller and faster, a little less accurate     |
| `bodypixInternalResolution` | `high`        | `low`, `medium`, `high`, `full` | The resolution each frame is scaled to before segmenting                  |
| `bodypixThreshold`          | `0.65`        | 0–1                             | How confident the model must be that a pixel is a person                  |
| `bodypixRefineSteps`        | `3`           | whole number                    | Passes to assign pixels to people: fewer is faster with groups            |

### MediaPipe

| Query              | Default | Values                  | What it does                                     |
| ------------------ | ------- | ----------------------- | ------------------------------------------------ |
| `mediapipeVariant` | `full`  | `lite`, `full`, `heavy` | Model size: lite is fastest, heavy most accurate |

### Camera

| Query             | Default | Values       | What it does                                                           |
| ----------------- | ------- | ------------ | ---------------------------------------------------------------------- |
| `cameraWidth`     | `1280`  | whole number | The camera resolution asked for; the camera may give something else    |
| `cameraHeight`    | `720`   | whole number | See `cameraWidth`                                                      |
| `cameraFeatherPx` | `3`     | whole number | How far the silhouette's edges fade out, in canvas pixels; `0` is hard |
| `cameraHoldMs`    | `400`   | whole number | How long a player the model loses is still shown (needs smoothing)     |
| `cameraFadeMs`    | `300`   | whole number | How long a held player then takes to fade out                          |
| `cameraFillGaps`  | `false` | boolean      | Fills parts the model missed for a frame from the frame before         |

[ADR 0007](ADRs/0007-camera-flicker.md) explains holding, fading and filling gaps.

### Jumps

Distances are fractions of the player's height. [Camera mode](camera-mode.md#jumps) explains how a jump is detected,
and [ADR 0008](ADRs/0008-jump-detection.md) how the defaults were chosen.

| Query               | Default | Values       | What it does                                      |
| ------------------- | ------- | ------------ | ------------------------------------------------- |
| `jumpMinRise`       | `0.04`  | 0–1          | The rise needed (about 5 cm for a 1.3 m child)    |
| `jumpStill`         | `0.02`  | 0–1          | How far standing feet may wander                  |
| `jumpMinGroundedMs` | `100`   | whole number | How long the feet must stand before a take-off    |
| `jumpMaxRiseMs`     | `500`   | whole number | The longest the feet may keep rising              |
| `jumpMaxAirtimeMs`  | `1000`  | whole number | The longest from leaving the ground to landing    |
| `jumpMinDescent`    | `0.5`   | 0–1          | How much of the rise the feet must come back down |

## Build and test variables

These are read by the build or the test runner, not the app:

| Variable                         | Documented in                         |
| -------------------------------- | ------------------------------------- |
| `BASE_URL`                       | [Deployment](deployment.md#base-path) |
| `VISION_BENCH`, `VISION_BENCH_*` | `tests/browser/vision-bench.spec.ts`  |
| `E2E_STATIC`                     | `playwright.config.ts`                |
