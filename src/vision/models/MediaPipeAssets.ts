import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url";
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.js?url";
import type { FilesetResolver } from "@mediapipe/tasks-vision";

/** Where MediaPipe's wasm runtime is; the library doesn't export the type. */
type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

/** The wasm runtime, once its loader has run. */
let loading: Promise<WasmFileset> | undefined;

/**
 * MediaPipe's wasm runtime, bundled from the installed package so it always matches the library's version.
 *
 * MediaPipe would load the loader with a classic script tag, which can't run the module variant (the only one that
 * also runs in module workers). So it is imported here, which sets `globalThis.ModuleFactory`, and MediaPipe is
 * given no loader path, which tells it the loader has already run.
 */
export const mediapipeWasm = (): Promise<WasmFileset> =>
  (loading ??= import(/* @vite-ignore */ wasmLoaderPath).then(() => ({ wasmLoaderPath: "", wasmBinaryPath })));

// ponytail: models load from Google's storage, as BodyPix's do; self-host them if the game must run offline
/** Where MediaPipe's published models are, pinned to version 1 of each. */
const MODEL_BASE_URL = "https://storage.googleapis.com/mediapipe-models";

/** The Pose Landmarker model of the given size. */
export const poseLandmarkerModelUrl = (variant: "lite" | "full" | "heavy"): string =>
  `${MODEL_BASE_URL}/pose_landmarker/pose_landmarker_${variant}/float16/1/pose_landmarker_${variant}.task`;

/** The selfie segmenter, which separates people from the background. */
export const SELFIE_SEGMENTER_MODEL_URL = `${MODEL_BASE_URL}/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`;

/** How confident a mask must be (0–1) that a pixel is a person. */
export const MASK_THRESHOLD = 0.5;

/** A confidence mask as a silhouette: 1 where the confidence reaches {@link MASK_THRESHOLD}. */
export const silhouetteOf = (confidence: Float32Array): Uint8Array => {
  const mask = new Uint8Array(confidence.length);
  for (let i = 0; i < confidence.length; i++) if (confidence[i] >= MASK_THRESHOLD) mask[i] = 1;
  return mask;
};

/** A timestamp later than the last one, as MediaPipe's video mode rejects any that doesn't increase. */
export const increasing = (timestamp: number, last: number): number => Math.max(timestamp, last + 1);
