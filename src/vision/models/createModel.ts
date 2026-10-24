import type { AppConfig } from "../../config/AppConfig";
import type { FootstepsVisionModelImplementation } from "../FootstepsVisionModelImplementation";
import { BodyPixModel } from "./BodyPixModel";
import { MediaPipePoseModel } from "./MediaPipePoseModel";
import { MoveNetModel } from "./MoveNetModel";

/** The vision model the config chooses, to run on this thread, not yet loaded. */
export const createModel = (config: AppConfig): FootstepsVisionModelImplementation => {
  switch (config.visionModel) {
    case "bodypix":
      return new BodyPixModel(config);
    case "mediapipe":
      return new MediaPipePoseModel(config);
    case "movenet":
      return new MoveNetModel(config);
  }
};
