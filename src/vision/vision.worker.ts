/// <reference lib="webworker" />
import { createModel } from "./models/createModel";
import type { FootstepsVisionModelImplementation } from "./FootstepsVisionModelImplementation";
import type { VisionWorkerRequest, VisionWorkerResponse } from "./VisionWorkerProtocol";

/** Runs a vision model off the main thread: loads it, tracks each frame the page sends, and returns the frame. */
let model: FootstepsVisionModelImplementation | undefined;

/** Sends a response, handing over the masks' buffers rather than copying them. */
const respond = (response: VisionWorkerResponse) => {
  const transfer = response.type === "frame" ? response.frame.people.map(({ mask }) => mask.buffer) : [];
  self.postMessage(response, transfer);
};

/** Handles one request; a failure is reported to the page, which rejects whatever it was waiting for. */
const handle = async (request: VisionWorkerRequest) => {
  if (request.type === "load") {
    model = createModel(request.config);
    await model.load();
    return respond({ type: "loaded" });
  }
  if (request.type === "detect") {
    try {
      if (!model) throw new Error("the vision model is not loaded");
      return respond({ type: "frame", frame: await model.detect(request.bitmap, request.timestamp) });
    } finally {
      request.bitmap.close();
    }
  }
  model?.dispose();
  self.close();
};

self.onmessage = ({ data }: MessageEvent<VisionWorkerRequest>) => {
  handle(data).catch((error: unknown) => respond({ type: "error", message: String(error) }));
};
