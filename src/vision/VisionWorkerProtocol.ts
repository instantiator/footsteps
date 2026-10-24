import type { AppConfig } from "../config/AppConfig";
import type { VisionFrame } from "./VisionTypes";

/** Asks the worker to load the configured model. */
interface LoadRequest {
  /** The kind of request. */
  type: "load";
  /** Which model to load, and its settings. */
  config: AppConfig;
}

/** Asks the worker to track one camera frame. */
interface DetectRequest {
  /** The kind of request. */
  type: "detect";
  /** The frame, transferred to the worker, which closes it. */
  bitmap: ImageBitmap;
  /** When the frame was taken, in milliseconds. */
  timestamp: number;
}

/** Asks the worker to release its model and stop. */
interface DisposeRequest {
  /** The kind of request. */
  type: "dispose";
}

/** What the page asks the vision worker to do. */
export type VisionWorkerRequest = LoadRequest | DetectRequest | DisposeRequest;

/** The model has loaded. */
interface LoadedResponse {
  /** The kind of response. */
  type: "loaded";
}

/** A frame was tracked. */
interface FrameResponse {
  /** The kind of response. */
  type: "frame";
  /** What the model found, with its masks' buffers transferred to the page. */
  frame: VisionFrame;
}

/** The last request failed. */
interface ErrorResponse {
  /** The kind of response. */
  type: "error";
  /** What went wrong. */
  message: string;
}

/** What the vision worker answers. */
export type VisionWorkerResponse = LoadedResponse | FrameResponse | ErrorResponse;
