# ADR 0004: Vision optimisations

- Status: Proposed
- Date: 2026-10-24

## Context

Body tracking ran BodyPix (ResNet50, output stride 32, 4-byte weights) on tfjs WebGL, on every animation frame.
It had a low frame rate, a coarse mask, flickering, and merged several players into one.

## Measurements

Measured with `VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench`: headless Chromium on an M1 MacBook Pro
(Metal via ANGLE), the fake camera's 640×480 "person" scene, median of 10 one-second samples.

| Configuration                         | fps | Inference (ms) |
| ------------------------------------- | --: | -------------: |
| Baseline: BodyPix ResNet50, stride 32 | 6.2 |            148 |
