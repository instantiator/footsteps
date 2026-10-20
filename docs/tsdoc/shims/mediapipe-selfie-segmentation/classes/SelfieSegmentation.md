[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [shims/mediapipe-selfie-segmentation](../README.md) / SelfieSegmentation

# Class: SelfieSegmentation

Defined in: [shims/mediapipe-selfie-segmentation.ts:6](https://github.com/instantiator/2025-xmas-game/blob/main/src/shims/mediapipe-selfie-segmentation.ts#L6)

Stand-in for `@mediapipe/selfie_segmentation`, a global script with no ES exports that
vite 8 (Rolldown) refuses to bundle. body-segmentation imports it only for its MediaPipe
runtime; we use BodyPix on tfjs, so reaching this constructor is a bug.

## Constructors

### Constructor

> **new SelfieSegmentation**(): `SelfieSegmentation`

Defined in: [shims/mediapipe-selfie-segmentation.ts:7](https://github.com/instantiator/2025-xmas-game/blob/main/src/shims/mediapipe-selfie-segmentation.ts#L7)

#### Returns

`SelfieSegmentation`
