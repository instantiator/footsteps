# ADR 0004: Vision optimisations

- Status: Accepted
- Date: 2026-10-24

## Context

Body tracking ran BodyPix (ResNet50, output stride 32, 4-byte weights) on tfjs WebGL, on every animation frame,
on the main thread. It managed about 6 fps, its masks were coarse, labels flickered between frames, the background
confused it, and several players were merged into one. The game runs in a lit room with an uncontrolled
background, on a mains-powered M1 MacBook Pro with 16 GB of memory, in a modern browser. A remote service was ruled
out unless it was much faster, nearly free, and adds little latency.

[ADR 0005](0005-vision-models.md) covers which model to use. This record covers how to run any model faster and
more steadily.

## Decision

The game adopts these, all set through app config (`.env*`, overridable by URL query):

1. **Per-person segmentation.** BodyPix ran without `multiSegmentation`, so it returned everyone as one mask, and
   `players` never had more than one entry. It now segments each person (`segmentMultiPersonParts`), up to
   `VITE_VISION_MAX_PEOPLE`.
2. **Standalone `@tensorflow-models/body-pix`**, not `@tensorflow-models/body-segmentation`. The latter wraps
   the former, converts every mask to RGBA in a JavaScript loop, needs `document` (so it can't run in a
   worker), and imports `@mediapipe/selfie_segmentation`, which needed a bundling shim. One pass over each
   mask now builds the silhouette and the key points together.
3. **WebGPU**, falling back to WebGL (`VITE_VISION_BACKEND`). It roughly halves inference time on the M1.
4. **One frame per camera frame.** The loop follows `requestVideoFrameCallback`, not `requestAnimationFrame`,
   so a 30 fps camera isn't tracked two to four times per frame on a 60–120 Hz display.
5. **The camera asks for 1280×720** (`VITE_CAMERA_WIDTH`/`HEIGHT`), not the browser's default, usually 640×480.
   **The model is given a copy scaled to 960 wide** (`VITE_VISION_INPUT_WIDTH`). Masks come back at the size of the
   frame given, so this makes every per-pixel step after the model cheaper too. The silhouettes are scaled back up
   when drawn.
6. **BodyPix makes 3 passes, not 10, to assign pixels to people** (`VITE_BODYPIX_REFINE_STEPS`). This made no
   difference to the people, hands and feet found.
7. **A web worker** (`VITE_VISION_WORKER`). Frames go to it as transferred `ImageBitmap`s, and masks come back
   without copying, so inference and mask building no longer hold up React rendering.
8. **Temporal smoothing** (`VITE_VISION_SMOOTHING`, `VITE_VISION_STABLE_FRAMES`). A tracker matches people to
   the previous frame by silhouette centre, so ids stay stable. A One Euro filter smooths each key point, and an
   interaction must hold for 2 frames before it fires.
9. **Model settings in config**: architecture, output stride, weight bytes, internal resolution and threshold
   for BodyPix, and the model size for MediaPipe.

## Measurements

Measured with `VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench`: headless Chromium on an M1 MacBook Pro
(Metal via ANGLE, `--enable-unsafe-webgpu`), a fake 640×480 camera at 30 fps, and the median of one-second samples.
The 30 fps camera caps every row.

These rows were measured on the fake camera's drawn scene, which neither model recognises as a person, so they
show the cost with nobody in shot. [ADR 0005](0005-vision-models.md) has the measurements with people, from photos.

| Configuration                                                         |  fps | Inference (ms) |
| --------------------------------------------------------------------- | ---: | -------------: |
| Baseline: ResNet50, stride 32, 4-byte, everyone in one mask, WebGL    |  6.2 |            148 |
| ResNet50, stride 16, 2-byte weights, per-person (`multiSegmentation`) |  4.5 |            197 |
| ResNet50, stride 32, 2-byte, per-person                               |  6.1 |            137 |
| ResNet50, stride 32, 2-byte, per-person, medium internal resolution   | 10.0 |             81 |
| MobileNetV1 (0.75), stride 16, 2-byte, per-person                     | 16.6 |             32 |
| MobileNetV1 (0.75), stride 8, 2-byte, per-person                      | 14.9 |             53 |
| WebGPU: ResNet50, stride 32, 2-byte, per-person                       | 10.0 |             66 |
| WebGPU: ResNet50, stride 16, 2-byte, per-person                       |  7.7 |             97 |
| WebGPU: MobileNetV1 (0.75), stride 16, 2-byte, per-person             | 22.9 |             23 |

### At the real camera's resolution

The rows above, and ADR 0005's comparison, used a 640×480 fake camera, but the game asks a real camera for
1280×720. At 720p, with the 25 photos of people, the default as first chosen (full frame, 10 refinement steps) slowed
to 4.3 fps (208 ms), and 1.6–2.6 fps for groups of four or more. Options were then benched at 720p
(`VISION_BENCH_CAMERA` defaults to `1280x720`):

| Setup (BodyPix MobileNetV1 s16, WebGPU, worker, 720p camera) | Hands found | Feet found | Median fps | Median ms |
| ------------------------------------------------------------ | ----------: | ---------: | ---------: | --------: |
| Full frame, high internal resolution, 10 refinement steps    |      83/126 |     76/108 |        4.3 |       208 |
| Input 640 wide                                               |      52/126 |     55/108 |       10.7 |        63 |
| Medium internal resolution                                   |      71/126 |     68/108 |        4.8 |       182 |
| 5 refinement steps                                           |      83/126 |     77/108 |        5.6 |       140 |
| 3 refinement steps                                           |      86/126 |     77/108 |        6.8 |       115 |
| Input 640 wide, 5 refinement steps                           |      54/126 |     55/108 |       14.9 |        41 |
| Input 640 wide, medium, 5 refinement steps                   |      18/126 |     40/108 |       15.1 |        40 |
| Input 960 wide, 5 refinement steps                           |      80/126 |     75/108 |        9.6 |        81 |
| **Input 960 wide, 3 refinement steps (the default)**         |  **80/126** | **75/108** |   **10.0** |    **68** |

- Fewer refinement steps cost nothing measurable: hands and feet held, and the group screenshots showed no limbs
  given to the wrong person.
- A smaller input is the big lever, but 640 wide lost about a third of the hands and feet and merged people in
  groups. 960 wide kept 96–99% of them.
- Medium internal resolution was barely faster, and lost hands and feet.

With the default, an empty room runs at 15 fps (38 ms), one or two people at 10–13 fps (50–65 ms), and groups of
four to ten at 4.6–7.3 fps (100–180 ms).

Where fps × inference falls well short of a second (MobileNetV1 on WebGL: 16.6 × 32 ms ≈ 0.5 s), the rest of each
frame went to JavaScript pixel loops on the main thread. The worker moves those off it. In the headless bench
nothing else competes for the main thread, so the worker's gain shows in the game's smoothness, not in these
numbers.

## Options considered

| Option                                 | Outcome      | Notes                                                                                                                                                                                                     |
| -------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-person segmentation                | adopted      | Fixes multiple players. Each extra person costs another full-size mask to read back and process, so time grows with the number of people.                                                                 |
| Output stride                          | in config    | Smaller is finer but slower. ResNet50 has only 16/32; MobileNetV1 only 8/16. ResNet50 at stride 16 was 30–45% slower than at 32, and no better in the photos.                                             |
| Weight bytes (`quantBytes`)            | 2, in config | Smaller downloads and faster; no visible loss at 2.                                                                                                                                                       |
| Architecture                           | MobileNetV1  | 3–6× faster than ResNet50 here, and the most usable cut-outs across 25 photos ([ADR 0005](0005-vision-models.md)).                                                                                        |
| Internal resolution                    | in config    | `medium` nearly doubled ResNet50's speed; kept at `high` for mask quality.                                                                                                                                |
| Camera resolution and model input      | 720p, 960    | More pixels place more hands and feet, but each costs time in every per-pixel step. Scaling the model's copy to 960 wide kept 96–99% of them, at a third of the time.                                     |
| WebGL vs WebGPU                        | WebGPU       | About 2× faster. The backend must be imported statically: a dynamic import bundled its own `tfjs-core`, which broke the shared engine. Backend switches are serialised, because two loading models raced. |
| WebNN / Apple Neural Engine            | not adopted  | WebNN is a Chrome origin trial (146–147), and its ONNX Runtime path is Windows-only. Nothing reaches the Neural Engine from a browser yet. Revisit when WebNN ships with a Core ML backend.               |
| Integer arithmetic                     | already used | Masks are `Uint8Array`s and loops use integer indices. JavaScript JITs already use integers for these, so there is little to gain.                                                                        |
| Avoiding repeated work                 | adopted      | `body-segmentation` read each mask back and converted it up to three times per frame. Now there is one pass per person, and drawing builds one image per frame.                                           |
| Region of interest (crop to players)   | not adopted  | MediaPipe already crops to each detected person. BodyPix needs the whole frame to find people, and cropping to the interactive elements would miss players moving into them.                              |
| Web worker                             | adopted      | Inference and pixel loops leave the main thread. MediaPipe's wasm runs in a module worker once we import its module loader ourselves.                                                                     |
| Temporal smoothing and identity        | adopted      | Steadier key points and interactions; ids survive people swapping places in the model's output.                                                                                                           |
| Lighting and background                | advice only  | Light players from the front; avoid a bright window behind them. Every model lost backlit people in the photos (1 of 3 found). Plain, contrasting clothing helps the masks.                               |
| USB accelerators (Coral, Hailo, NCS2)  | not adopted  | Browsers can't reach them (they need native runtimes; WebUSB can't run their drivers). They're also slower than the M1's GPU, and the Intel NCS2 is discontinued.                                         |
| Remote inference                       | not adopted  | A round trip costs more than a frame, needs a network at the venue, and costs money per frame. None of the "compelling" conditions were met.                                                              |
| Fewer refinement steps (`refineSteps`) | 3            | BodyPix refines its pixel-to-person assignment on the GPU, 10 times by default. 3 was 45% faster at 720p, with no loss in the bench.                                                                      |

## Consequences

- The defaults, in `.env`: BodyPix MobileNetV1, stride 16, 2-byte weights, 3 refinement steps, given frames 960 wide,
  on WebGPU, in a worker, with smoothing and 2 stable frames. Every setting can be changed per environment, or per visit by URL query, eg.
  `?visionModel=movenet&visionWorker=false`.
- `?debug=true` shows the frame rate, inference time and people found, over the silhouette.
- The bench can be repeated for any configuration: set `VISION_BENCH_QUERY` (eg. `&visionModel=mediapipe`).
- [ADR 0002](0002-camera-interactions.md) noted that players were identified by their index in the segmentation,
  so two players swapping order swapped monitors. The tracker now keeps ids stable while people stay in view.
- A body-part interaction such as "hand" now fires when either hand meets the threshold. Before, both hands'
  pixels were pooled.
- Unit tests run with `VITE_VISION_WORKER=false` and `VITE_VISION_STABLE_FRAMES=1` (`.env.test`), as jsdom has
  no workers.
