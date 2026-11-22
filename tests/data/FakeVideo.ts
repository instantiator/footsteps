import type { VideoRecorder } from "../../src/debug/Recorder";

/** A video recorder that starts when told to, and records a fixed few bytes. */
export class FakeVideo implements VideoRecorder {
  readonly mimeType = "video/webm";
  stopped = 0;
  private onStarted?: () => void;
  start(onStarted: () => void) {
    this.onStarted = onStarted;
  }
  began() {
    this.onStarted?.();
  }
  async stop() {
    this.stopped++;
    return new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType });
  }
}
