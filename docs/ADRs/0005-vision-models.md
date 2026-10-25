# ADR 0005: Vision models

- Status: Accepted
- Date: 2026-10-24

## Context

Players were tracked by BodyPix (tfjs), which labels every pixel with one of 24 body parts. It was slow, it
flickered, background clutter confused it, and it merged several players into one. A game needs two things for
each player: a silhouette, to cut them out of the camera view, and the positions of their hands, feet and head.
It must run locally in a browser on an M1 MacBook Pro (16 GB). Models were surveyed in October 2026, and the
leading options were measured.

[ADR 0004](0004-vision-optimisations.md) covers how any model is run (backend, worker, smoothing).

## Decision

1. **Body-part segmentation is dropped.** Only BodyPix (deprecated) and Sapiens (far too heavy for a browser)
   label body parts per pixel. Every model instead gives a silhouette per person and key points: the centres of
   the hands and feet, and the top, bottom, left and right of the head. The "hand" in a query is a disc around the
   hand's key point, scaled to the person's head, and clipped to their silhouette. This keeps "50% of the hand is
   inside the box".
2. **Models sit behind `FootstepsVisionModelImplementation`** (`src/vision/`), with our own `BodyPart`s. The
   base class answers which body parts are at a point, and how much of each is inside an area, for any model's
   frames. `VITE_VISION_MODEL` chooses:
   - `bodypix`, **the default**: BodyPix MobileNetV1 (0.75), stride 16, via the standalone
     `@tensorflow-models/body-pix`. Key points are the centroids of its part pixels.
   - `mediapipe`: MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`), with 33 landmarks and a mask per person.
   - `movenet`: MoveNet MultiPose Lightning for the key points, with MediaPipe's selfie segmenter for the
     silhouette, divided between people by whose skeleton each pixel is nearest.
3. **BodyPix MobileNetV1 is the default** because it gave the most usable cut-outs across 25 photos: it separated
   groups into distinct people with their legs and feet, and placed the most hands and feet. It slows with large
   groups. [ADR 0004](0004-vision-optimisations.md) tunes it for the real camera's 720p: 10 fps for one or two
   people, 5–7 fps for groups.

## Measurements

`VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench` showed each scene to a fake camera (640×480, 30 fps)
in headless Chromium on an M1 MacBook Pro, with up to ten people allowed. The scenes are an empty room and 25
photos: indoor rooms, groups of 2–10, children, varied clothing, active poses, busy backgrounds, backlighting
and motion blur. They are CC0 or US-government public-domain photos from Wikimedia Commons
(`tests/browser/fixtures/people/`, with credits).

For each photo, the bench reports the people found, and the hands and feet placed, against the foreground people
in it. Feet are expected only in full-length photos. It also reports how far down the frame the silhouettes reach.
Found counts above the expected number (background people) count as the expected number in the totals.

| Setup (WebGPU, in the worker) | people found / expected | people exact | hands / expected | feet / expected (full length) | median fps | median ms |
| ----------------------------- | ----------------------- | ------------ | ---------------- | ----------------------------- | ---------- | --------- |
| bodypix-mobilenet-s16         | 48/63                   | 15/25        | 66/126           | 60/108                        | 10.1       | 72        |
| bodypix-resnet50-s32          | 50/63                   | 16/25        | 39/126           | 52/108                        | 7.4        | 111       |
| mediapipe-full                | 31/63                   | 13/25        | 51/126           | 45/108                        | 18.9       | 28        |
| movenet-selfie                | 45/63                   | 17/25        | 56/126           | 60/108                        | 28.5       | 20        |

Per photo: people · hands · feet (found/expected), silhouette reach (% of frame height), inference ms:

| Scene                      | bodypix-mobilenet-s16          | bodypix-resnet50-s32           | mediapipe-full                | movenet-selfie                 |
| -------------------------- | ------------------------------ | ------------------------------ | ----------------------------- | ------------------------------ |
| empty-room                 | 0/0 · 0/0 · 0/0 · 0% · 23      | 0/0 · 0/0 · 0/0 · 0% · 67      | 0/0 · 0/0 · 0/0 · 0% · 14     | 0/0 · 0/0 · 0/0 · 0% · 19      |
| jumping-arms-up            | 0/1 · 0/2 · 0/2 · 0% · 24      | 1/1 · 0/2 · 0/2 · 0% · 67      | 1/1 · 1/2 · 0/2 · 58% · 28    | 0/1 · 0/2 · 0/2 · 0% · 19      |
| jumping-side-on            | 1/1 · 2/2 · 2/2 · 69% · 42     | 1/1 · 1/2 · 1/2 · 61% · 76     | 1/1 · 2/2 · 2/2 · 69% · 29    | 1/1 · 2/2 · 2/2 · 68% · 19     |
| two-facing                 | 2/2 · 3/4 · 3/4 · 80% · 50     | 2/2 · 2/4 · 0/4 · 71% · 87     | 1/2 · 2/4 · 1/4 · 61% · 26    | 2/2 · 4/4 · 4/4 · 78% · 22     |
| three-friends              | 3/3 · 5/6 · 0/– · 94% · 89     | 3/3 · 3/6 · 0/– · 95% · 120    | 2/3 · 2/6 · 2/– · 95% · 40    | 3/3 · 3/6 · 0/– · 95% · 25     |
| two-from-behind            | 2/2 · 4/4 · 0/4 · 93% · 88     | 2/2 · 3/4 · 0/4 · 92% · 124    | 1/2 · 2/4 · 0/4 · 94% · 29    | 2/2 · 3/4 · 0/4 · 92% · 24     |
| busy-street                | 2/2 · 3/4 · 4/4 · 92% · 43     | 2/2 · 2/4 · 3/4 · 91% · 84     | 1/2 · 2/4 · 2/4 · 92% · 28    | 2/2 · 3/4 · 4/4 · 82% · 23     |
| backlit-three              | 1/3 · 1/6 · 0/– · 69% · 60     | 1/3 · 2/6 · 1/– · 74% · 126    | 0/3 · 0/6 · 0/– · 0% · 22     | 1/3 · 0/6 · 0/– · 67% · 20     |
| indoor-skateboarder-couch  | 1/1 · 1/2 · 1/2 · 64% · 66     | 1/1 · 0/2 · 1/2 · 65% · 98     | 1/1 · 2/2 · 2/2 · 66% · 26    | 1/1 · 2/2 · 2/2 · 88% · 20     |
| indoor-artistic-room       | 1/1 · 0/2 · 0/2 · 83% · 38     | 1/1 · 0/2 · 0/2 · 83% · 75     | 1/1 · 1/2 · 2/2 · 88% · 27    | 1/1 · 1/2 · 2/2 · 94% · 20     |
| indoor-kitchen-motion-blur | 0/1 · 0/2 · 0/– · 0% · 47      | 0/1 · 0/2 · 0/– · 0% · 107     | 0/1 · 0/2 · 0/– · 0% · 16     | 0/1 · 0/2 · 0/– · 0% · 19      |
| indoor-dance-studio        | 1/1 · 1/2 · 1/2 · 100% · 75    | 1/1 · 1/2 · 1/2 · 100% · 111   | 1/1 · 2/2 · 1/2 · 100% · 28   | 1/1 · 1/2 · 2/2 · 100% · 20    |
| indoor-aerobathon          | 2/2 · 2/4 · 3/4 · 88% · 102    | 3/2 · 1/4 · 5/4 · 90% · 137    | 1/2 · 2/4 · 2/4 · 98% · 27    | 2/2 · 4/4 · 3/4 · 82% · 29     |
| group-zumba-class          | 7/6 · 9/12 · 11/12 · 73% · 162 | 6/6 · 3/12 · 11/12 · 74% · 185 | 2/6 · 4/12 · 4/12 · 86% · 40  | 5/6 · 5/12 · 5/12 · 80% · 31   |
| group-step-aerobics        | 5/4 · 6/8 · 6/8 · 61% · 106    | 6/4 · 2/8 · 3/8 · 59% · 140    | 2/4 · 4/8 · 4/8 · 77% · 41    | 4/4 · 2/8 · 6/8 · 68% · 25     |
| group-navy-fitness         | 5/2 · 6/4 · 7/4 · 74% · 105    | 7/2 · 2/4 · 10/4 · 70% · 144   | 2/2 · 4/4 · 4/4 · 82% · 41    | 3/2 · 6/4 · 5/4 · 74% · 24     |
| group-rugby-team           | 6/10 · 6/20 · 9/20 · 74% · 131 | 6/10 · 2/20 · 6/20 · 72% · 161 | 2/10 · 2/20 · 4/20 · 83% · 40 | 6/10 · 5/20 · 11/20 · 76% · 27 |
| group-rugby-scrum          | 3/10 · 3/20 · 4/20 · 65% · 137 | 4/10 · 2/20 · 5/20 · 65% · 180 | 2/10 · 3/20 · 4/20 · 75% · 40 | 1/10 · 1/20 · 2/20 · 76% · 20  |
| group-zumba-youths         | 4/2 · 4/4 · 5/– · 93% · 208    | 4/2 · 4/4 · 3/– · 89% · 237    | 2/2 · 4/4 · 0/– · 100% · 40   | 3/2 · 3/4 · 2/– · 93% · 32     |
| child-girl-dress           | 1/1 · 2/2 · 2/2 · 86% · 67     | 1/1 · 1/2 · 2/2 · 84% · 103    | 1/1 · 1/2 · 2/2 · 85% · 27    | 1/1 · 2/2 · 2/2 · 86% · 20     |
| child-backyard             | 2/2 · 3/4 · 0/4 · 60% · 72     | 2/2 · 1/4 · 2/4 · 75% · 132    | 1/2 · 2/4 · 0/4 · 78% · 26    | 2/2 · 2/4 · 0/4 · 72% · 24     |
| child-skate-park           | 1/1 · 2/2 · 0/2 · 62% · 37     | 1/1 · 1/2 · 1/2 · 63% · 76     | 1/1 · 2/2 · 2/2 · 64% · 28    | 1/1 · 2/2 · 2/2 · 55% · 20     |
| child-gym-jumping          | 5/2 · 2/4 · 7/4 · 72% · 74     | 5/2 · 2/4 · 3/4 · 63% · 108    | 2/2 · 2/4 · 4/4 · 79% · 40    | 2/2 · 2/4 · 4/4 · 82% · 25     |
| active-skateboard-trick    | 1/1 · 1/2 · 2/2 · 82% · 73     | 1/1 · 2/2 · 2/2 · 82% · 113    | 1/1 · 2/2 · 2/2 · 88% · 28    | 1/1 · 1/2 · 2/2 · 86% · 20     |
| active-runner-forest       | 1/1 · 0/2 · 2/2 · 88% · 63     | 1/1 · 0/2 · 1/2 · 87% · 94     | 1/1 · 1/2 · 2/2 · 94% · 28    | 1/1 · 2/2 · 2/2 · 85% · 20     |
| active-sprint-start        | 1/1 · 2/2 · 2/2 · 62% · 58     | 1/1 · 2/2 · 2/2 · 64% · 95     | 1/1 · 2/2 · 1/2 · 65% · 28    | 1/1 · 2/2 · 1/2 · 66% · 20     |

The counts don't show whether a person was actually cut out, so the debug view of every scene was compared too.
Each person is tinted; the head is red, the hands green and blue, the feet yellow and pink:

- [Comparison 1](images/0005-compare-1.jpg): empty room, jumps, two facing, three friends, from behind, busy street,
  backlit, skateboarder indoors.
- [Comparison 2](images/0005-compare-2.jpg): room, motion blur, dance studio, aerobics, zumba, step, navy, rugby.
- [Comparison 3](images/0005-compare-3.jpg): youths, children, skateboard trick, runner, sprint start.

What the views show:

- **BodyPix MobileNetV1** gives the most usable cut-outs. It separates groups (zumba, step aerobics, rugby team)
  into distinct people, mostly down to their feet. It also picks up people in the background, and sometimes lends
  one person's limb to their neighbour.
- **MoveNet + selfie** places key points well, but the selfie segmenter, made for close-up selfies, often fails to cut
  out anyone not close to the camera: in "busy street", "artistic room" and "child skate park" almost nothing is
  masked. It merged the rugby scrum into one blob. Its people and feet counts come from key points, not cut-outs.
- **MediaPipe Pose** gives crisp masks, but it found only one or two people in every group.
- **BodyPix ResNet50 s32** is slower, with coarse, fragmented masks, and it placed the fewest hands.
- Every model missed the motion-blurred person, the small greyscale jumper (bar ResNet50 and MediaPipe), and most
  of the backlit silhouettes.

An earlier round on the first seven photos also measured BodyPix ResNet50 at stride 16 (slower than stride 32, and
it lost most of one person), MediaPipe lite and heavy (no better at finding people than full), and MoveNet on WebGL
(about twice as slow as on WebGPU).

## Options considered

| Model                                     | Runs on                               | People     | Silhouette         | Key points            | Licence      | Outcome                  |
| ----------------------------------------- | ------------------------------------- | ---------- | ------------------ | --------------------- | ------------ | ------------------------ |
| BodyPix MobileNetV1 / ResNet50            | tfjs, WebGL or WebGPU                 | up to 10   | yes, 24 body parts | from part centroids   | Apache-2.0   | default (MobileNetV1)    |
| MediaPipe Pose Landmarker lite/full/heavy | tasks-vision wasm, GPU delegate       | several    | yes                | 33, incl. heels, toes | Apache-2.0   | implemented              |
| MoveNet MultiPose Lightning               | tfjs graph model                      | up to 6    | no                 | 17                    | Apache-2.0   | implemented, with selfie |
| MediaPipe selfie segmenter                | tasks-vision wasm, GPU delegate       | all as one | yes                | none                  | Apache-2.0   | MoveNet's silhouette     |
| YOLO26 pose / segmentation                | `@ultralytics/yolo`, LiteRT.js WebGPU | many       | yes                | 17                    | AGPL-3.0     | not chosen               |
| RTMPose / RTMO (MMPose)                   | ONNX Runtime Web (eg. rtmlib-ts)      | many       | no                 | 17–133 (whole body)   | Apache-2.0   | not chosen               |
| Sapiens body-part segmentation            | PyTorch / ONNX                        | many       | yes, 28 parts      | 308                   | CC BY-NC 4.0 | not chosen               |
| SAM 2 / EfficientSAM                      | ONNX / WebGPU                         | prompted   | yes                | none                  | Apache-2.0   | not chosen               |

### BodyPix (kept, default)

- **For:** it is the only real-time model that segments each person in a browser out of the box, and its cut-outs
  were the most usable across 25 photos. Tuned for a 720p camera (ADR 0004), it runs at 10–13 fps for one or two
  people.
- **Against:** deprecated by Google since 2023, and loaded from Google's storage. Its per-person split runs on the
  GPU, and each person adds a full-size mask to read back and process, so time grows with the number of people:
  5–7 fps for groups of four or more at 720p. It also finds
  background people, which a game may not want as players. It lost the small greyscale jumper (as did MediaPipe and MoveNet;
  ResNet50 found them). It ignores `flipHorizontal` for masks, which is fine here because the canvas is mirrored
  with CSS.

### MediaPipe Pose Landmarker (implemented)

- **For:** the fastest (15–40 ms), crisp masks, maintained (1.x in 2026), and 33 landmarks including heels and toes
  for precise feet. The wasm runtime is bundled from the package, so it always matches the library.
- **Against:** it found only one or two people in every group, and 31 of 63 people overall. Its detector favours one
  prominent person, so it suits single-player games. Its model files load from Google's storage.

### MoveNet MultiPose with the selfie segmenter (implemented)

- **For:** the fastest option (20 ms on WebGPU, 28 fps), at a steady cost as people are added, with the most exact
  people counts. It is loaded as a plain tfjs graph model, with our own decoding, so it needs no new
  dependency.
- **Against:** no silhouette of its own. The selfie segmenter is made for close-up selfies: it often fails to cut out
  people further from the camera, and lets background through. Hands and feet are estimated beyond the wrists and ankles. The
  official `@tensorflow-models/pose-detection` package was avoided, because it imports `@mediapipe/pose`, which
  can't be bundled.

### YOLO26 (not chosen)

Ultralytics' YOLO26 (September 2025) does pose and instance segmentation in one model, and has an official browser
package on LiteRT.js with WebGPU. It is a strong candidate for accuracy with many people and cluttered backgrounds.
But it is AGPL-3.0, which would oblige us to publish the game's source under the AGPL, or to buy an Ultralytics
licence. Revisit if the licence is acceptable, as the next model to add behind the interface.

### RTMPose / RTMO (not chosen)

These are accurate multi-person whole-body pose models (Apache-2.0) that run in the browser through ONNX Runtime Web
(rtmlib-ts reports 40–200 ms). They have no silhouette, so they would need a segmenter as MoveNet does, and they
add a second ML runtime. Revisit if hand or finger precision matters.

### Sapiens, SAM 2 (not chosen)

Meta's Sapiens does excellent 28-part body segmentation, but the useful sizes are 0.3–2 billion parameters at
1024 px; it is non-commercial and nowhere near real time in a browser. SAM-family models segment anything, but
they need prompts (points or boxes) every frame and are too slow for 30 fps.

### Hardware and WebNN

WebNN, which could reach the Apple Neural Engine, is only in a Chrome origin trial (146–147). ONNX Runtime's WebNN
path is Windows-only, and Safari has given no signal. Revisit when it ships. See
[ADR 0004](0004-vision-optimisations.md) for USB accelerators and remote inference.

## Consequences

- Games and the interaction monitor see only our `BodyPart`s (`body`, `head`, hands and feet), and never a
  model's own labels. Adding a model means one class in `src/vision/models/` and a case in `createModel`.
- Switching model needs no code change: `.env`, or `?visionModel=mediapipe` for one visit.
- The bench's photos and per-scene report make a model change measurable, both in speed and in people found.
- BodyPix and MoveNet load models from Google's storage, and MediaPipe's model files load from Google's storage
  too. A venue without internet would need them self-hosted: see `docs/outstanding-issues.md`.
- The head box for MediaPipe and MoveNet comes from the ears and eyes, with typical proportions. It is not
  measured from the mask, so it is approximate.

## Sources

- BodyPix and body-segmentation (deprecated): <https://github.com/tensorflow/tfjs-models/tree/master/body-segmentation>
- MediaPipe Pose Landmarker: <https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker>
- MoveNet MultiPose: <https://www.kaggle.com/models/google/movenet>
- YOLO26: <https://docs.ultralytics.com/models/yolo26/>
- RTMPose and rtmlib-ts: <https://dev.to/gohdev_1/rtmlib-ts-real-time-pose-estimation-object-detection-in-browser-with-typescript-yolo12-48ep>
- Sapiens: <https://github.com/facebookresearch/sapiens>
- WebNN origin trial: <https://groups.google.com/a/chromium.org/g/blink-dev/c/5CWKSChYo98>
