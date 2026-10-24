# ADR 0004: Vision optimisations

- Status: Proposed
- Date: 2026-10-24

## Context

Body tracking ran BodyPix (ResNet50, output stride 32, 4-byte weights) on tfjs WebGL, on every animation frame.
It had a low frame rate, a coarse mask, flickering, and merged several players into one.

## Measurements

Measured with `VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench`: headless Chromium on an M1 MacBook Pro
(Metal via ANGLE), the fake camera's 640×480 "person" scene, median of 10 one-second samples.

| Configuration                                                         |  fps | Inference (ms) |
| --------------------------------------------------------------------- | ---: | -------------: |
| Baseline: BodyPix ResNet50, stride 32                                 |  6.2 |            148 |
| ResNet50, stride 16, 2-byte weights, per-person (`multiSegmentation`) |  4.5 |            197 |
| ResNet50, stride 32, 2-byte, per-person                               |  6.1 |            137 |
| ResNet50, stride 32, 2-byte, per-person, medium internal resolution   | 10.0 |             81 |
| MobileNetV1 (0.75), stride 16, 2-byte, per-person                     | 16.6 |             32 |
| MobileNetV1 (0.75), stride 8, 2-byte, per-person                      | 14.9 |             53 |

The fake camera runs at 30 fps, which caps every row. Where fps × inference falls well short of 1 second
(MobileNetV1: 16.6 × 32 ms ≈ 0.5 s), the rest of each frame goes to the JavaScript pixel loops on the main
thread: building masks and key points, and the silhouette images.
