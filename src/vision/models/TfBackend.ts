import * as tf from "@tensorflow/tfjs";
// Registers the WebGPU backend. Imported statically: a dynamic import is bundled with its own copy of tfjs-core,
// which breaks the engine that the models share.
import "@tensorflow/tfjs-backend-webgpu";
import type { AppConfig } from "../../config/AppConfig";

/** Switches to one backend, falling back from WebGPU to WebGL. */
const switchTo = async (backend: AppConfig["visionBackend"]): Promise<string> => {
  if (backend === "webgpu") {
    try {
      if (await tf.setBackend("webgpu")) return "webgpu";
    } catch (error) {
      console.warn("Could not start WebGPU:", error);
    }
    console.warn("WebGPU is unavailable; using WebGL");
  }
  await tf.setBackend("webgl");
  await tf.ready();
  return tf.getBackend();
};

/** The latest backend switch; each waits for the one before, as tfjs's backend is global. */
let switching: Promise<string> = Promise.resolve("");

/**
 * Switches tfjs to the configured backend, falling back from WebGPU to WebGL where WebGPU is unavailable.
 *
 * Switches run one at a time: two models loading at once (eg. React's development double mount) would
 * otherwise race, and one would lose WebGPU or load its weights on the wrong backend.
 * @returns the backend in use
 */
export const selectTfBackend = (backend: AppConfig["visionBackend"]): Promise<string> =>
  (switching = switching.catch(() => "").then(() => switchTo(backend)));
