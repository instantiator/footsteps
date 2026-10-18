/**
 * Stand-in for `@mediapipe/selfie_segmentation`, a global script with no ES exports that
 * vite 8 (Rolldown) refuses to bundle. body-segmentation imports it only for its MediaPipe
 * runtime; we use BodyPix on tfjs, so reaching this constructor is a bug.
 */
export class SelfieSegmentation {
  constructor() {
    throw new Error("MediaPipe selfie segmentation is not bundled; use the BodyPix (tfjs) model");
  }
}
