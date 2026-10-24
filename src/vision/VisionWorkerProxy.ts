import type { AppConfig } from "../config/AppConfig";
import { FootstepsVisionModelImplementation } from "./FootstepsVisionModelImplementation";
import type { VisionFrame, VisionSource } from "./VisionTypes";
import type { VisionWorkerRequest, VisionWorkerResponse } from "./VisionWorkerProtocol";

/**
 * The configured vision model, run in a web worker so inference and mask building don't hold up the page.
 *
 * Each frame is captured as a bitmap and handed to the worker; the masks come back without copying.
 * Requests are answered in order, and the tracking loop waits for each frame before sending the next.
 */
export class VisionWorkerProxy extends FootstepsVisionModelImplementation {
  private readonly config: AppConfig;
  private worker: Worker | null = null;
  /** The request awaiting an answer. */
  private pending: { resolve: (response: VisionWorkerResponse) => void; reject: (error: Error) => void } | null = null;

  /** @param config which model the worker runs, and its settings */
  constructor(config: AppConfig) {
    super();
    this.config = config;
  }

  async load(): Promise<void> {
    this.worker = new Worker(new URL("./vision.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = ({ data }: MessageEvent<VisionWorkerResponse>) => this.settle(data);
    this.worker.onerror = (event) => this.fail(new Error(`The vision worker failed: ${event.message}`));
    await this.request({ type: "load", config: this.config });
  }

  async detect(source: VisionSource, timestamp: number): Promise<VisionFrame> {
    const bitmap = "videoWidth" in source ? await createImageBitmap(source) : source;
    const response = await this.request({ type: "detect", bitmap, timestamp }, [bitmap]);
    if (response.type !== "frame") throw new Error(`The vision worker answered ${response.type} to a frame`);
    return response.frame;
  }

  dispose(): void {
    this.worker?.postMessage({ type: "dispose" } satisfies VisionWorkerRequest);
    this.worker = null;
    this.fail(new Error("The vision model was disposed"));
  }

  /** Sends a request, and resolves with the worker's answer. */
  private request(request: VisionWorkerRequest, transfer: Transferable[] = []): Promise<VisionWorkerResponse> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("The vision worker is not running"));
    if (this.pending) return Promise.reject(new Error("The vision worker is busy"));
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      worker.postMessage(request, transfer);
    });
  }

  /** Answers the pending request; an error response rejects it. */
  private settle(response: VisionWorkerResponse): void {
    if (response.type === "error") return this.fail(new Error(response.message));
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(response);
  }

  /** Rejects the pending request, if any. */
  private fail(error: Error): void {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(error);
  }
}
