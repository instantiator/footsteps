import type { AppConfig } from "../config/AppConfig";
import type { FootstepsVisionModelImplementation } from "./FootstepsVisionModelImplementation";
import { createModel } from "./models/createModel";
import { VisionWorkerProxy } from "./VisionWorkerProxy";

/** The vision model the config chooses, not yet loaded: in a web worker if the config asks and the browser can. */
export const createVisionModel = (config: AppConfig): FootstepsVisionModelImplementation =>
  config.visionWorker && typeof Worker !== "undefined" ? new VisionWorkerProxy(config) : createModel(config);
