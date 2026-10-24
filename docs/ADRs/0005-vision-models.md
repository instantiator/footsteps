# ADR 0005: Vision models

- Status: Proposed
- Date: 2026-10-24

## Context

Players were tracked by BodyPix (tfjs), which labels every pixel with one of 24 body parts. It was slow and
flickered, background clutter confused it, and it merged several players into one. The game needs, for each
player, a silhouette to cut them out of the camera view, and the positions of their hands, feet and head. It
must run locally in a browser on an M1 MacBook Pro. Models were surveyed in October 2026.

## Decision

1. **Body-part segmentation is dropped.** Only BodyPix (deprecated) and Sapiens (too heavy for a browser)
   label body parts per pixel. Every model instead gives a silhouette per person and key points. A "hand"
   in a query is a disc around the hand's key point, scaled to the person, and clipped to their silhouette. This
   keeps "50% of the hand is in the box".
2. **Models sit behind `FootstepsVisionModelImplementation`** and are chosen by `VITE_VISION_MODEL`:
   - `bodypix`: BodyPix, via the standalone `@tensorflow-models/body-pix`;
   - `mediapipe`: MediaPipe Pose Landmarker;
   - `movenet`: MoveNet MultiPose for the key points, with the MediaPipe selfie segmenter for the silhouette.

## Options considered

| Model                                       | Runs on                               | People   | Silhouette | Key points            | Licence    | Outcome             |
| ------------------------------------------- | ------------------------------------- | -------- | ---------- | --------------------- | ---------- | ------------------- |
| BodyPix (ResNet50 / MobileNetV1)            | tfjs WebGL / WebGPU                   | many     | yes        | from part centroids   | Apache-2.0 | kept                |
| MediaPipe Pose Landmarker (lite/full/heavy) | tasks-vision, GPU delegate            | several  | yes        | 33, incl. heels, toes | Apache-2.0 | implemented         |
| MoveNet MultiPose Lightning                 | tfjs                                  | up to 6  | no         | 17, wrists and ankles | Apache-2.0 | implemented         |
| MediaPipe selfie / multiclass segmenter     | tasks-vision                          | combined | yes        | none                  | Apache-2.0 | paired with MoveNet |
| YOLO26 pose / segmentation                  | `@ultralytics/yolo`, LiteRT.js WebGPU | many     | yes        | 17                    | AGPL-3.0   | not chosen          |
| RTMPose / RTMO                              | ONNX Runtime Web (rtmlib-ts)          | many     | no         | 17–133 (whole body)   | Apache-2.0 | not chosen          |
| Sapiens (body-part segmentation)            | PyTorch / ONNX                        | many     | 28 parts   | 308                   | CC BY-NC   | not chosen          |
| SAM 2 / EfficientSAM                        | ONNX / WebGPU                         | prompted | yes        | none                  | Apache-2.0 | not chosen          |

## Measurements

`VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench` shows each scene to the fake camera (640×480,
30 fps) in headless Chromium on an M1 MacBook Pro. The scenes are an empty room, and seven CC0 photos of 1–3
people (`tests/browser/fixtures/people/`). Each cell gives the people found / expected, then the median inference
time in ms.

| Scene            | BodyPix ResNet50 s32, WebGL | BodyPix ResNet50 s32, WebGPU | BodyPix MobileNetV1 s16, WebGPU | MediaPipe Pose full |
| ---------------- | --------------------------- | ---------------------------- | ------------------------------- | ------------------- |
| empty room       | 0/0 · 138                   | 0/0 · 67                     | 0/0 · 23                        | 0/0 · 15            |
| jumping, arms up | 1/1 · 144                   | 1/1 · 68                     | 0/1 · 25                        | 0/1 · 14            |
| jumping, side-on | 1/1 · 144                   | 1/1 · 76                     | 1/1 · 40                        | 1/1 · 27            |
| two facing       | 2/2 · 152                   | 2/2 · 87                     | 2/2 · 49                        | 1/2 · 24            |
| three friends    | 3/3 · 152                   | 3/3 · 120                    | 3/3 · 86                        | 2/3 · 39            |
| two from behind  | 2/2 · 153                   | 2/2 · 124                    | 2/2 · 86                        | 1/2 · 25            |
| busy street      | 2/2 · 146                   | 2/2 · 84                     | 2/2 · 44                        | 1/2 · 26            |
| backlit three    | 1/3 · 149                   | 1/3 · 124                    | 1/3 · 57                        | 1/3 · 28            |

To be completed in stage 11, with each option's pros, cons and sources.
