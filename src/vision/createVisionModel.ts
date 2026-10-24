import type { AppConfig } from "../config/AppConfig";
import type { FootstepsVisionModelImplementation } from "./FootstepsVisionModelImplementation";
import { BodyPixModel } from "./models/BodyPixModel";

/** The vision model the config chooses, not yet loaded. */
export const createVisionModel = (config: AppConfig): FootstepsVisionModelImplementation => {
  switch (config.visionModel) {
    case "bodypix":
      return new BodyPixModel(config);
    case "mediapipe":
    case "movenet":
      // ponytail: stand-in until these models land (plan stages 8 and 9)
      console.warn(`The ${config.visionModel} vision model is not available yet; using bodypix`);
      return new BodyPixModel(config);
  }
};
