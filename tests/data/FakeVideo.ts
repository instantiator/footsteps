import type { VideoRecorder } from "../../src/debug/Recorder";

/** A video recorder that records a fixed few bytes, counting how often it was stopped. */
export class FakeVideo implements VideoRecorder {
  readonly mimeType = "video/webm";
  stopped = 0;
  start() {}
  async stop() {
    this.stopped++;
    return new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType });
  }
}
