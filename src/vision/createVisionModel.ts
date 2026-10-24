import type { AppConfig } from "../config/AppConfig";
import type { FootstepsVisionModelImplementation } from "./FootstepsVisionModelImplementation";
import { BodyPixModel } from "./models/BodyPixModel";
import { MediaPipePoseModel } from "./models/MediaPipePoseModel";

/** The vision model the config chooses, not yet loaded. */
export const createVisionModel = (config: AppConfig): FootstepsVisionModelImplementation => {
  switch (config.visionModel) {
    case "bodypix":
      return new BodyPixModel(config);
    case "mediapipe":
      return new MediaPipePoseModel(config);
    case "movenet":
      // ponytail: stand-in until MoveNet lands (plan stage 9)
      console.warn(`The ${config.visionModel} vision model is not available yet; using bodypix`);
      return new BodyPixModel(config);
  }
};
