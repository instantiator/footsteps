import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";
import type { VisionFrame } from "../src/vision/VisionTypes";
import type { VisionWorkerRequest, VisionWorkerResponse } from "../src/vision/VisionWorkerProtocol";
import { VisionWorkerProxy } from "../src/vision/VisionWorkerProxy";

/** A stand-in worker that records what it is sent, and answers when the test says. */
class FakeWorker {
  static latest: FakeWorker;
  readonly sent: { request: VisionWorkerRequest; transfer: Transferable[] }[] = [];
  onmessage: ((event: MessageEvent<VisionWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly url: URL;
  readonly options: WorkerOptions;

  constructor(url: URL, options: WorkerOptions) {
    [this.url, this.options] = [url, options];
    FakeWorker.latest = this;
  }

  postMessage(request: VisionWorkerRequest, transfer: Transferable[] = []) {
    this.sent.push({ request, transfer });
  }

  /** Delivers a response to the proxy. */
  answer(response: VisionWorkerResponse) {
    this.onmessage?.(new MessageEvent("message", { data: response }));
  }
}

const bitmap = { close: vi.fn() };
const video = document.createElement("video");
Object.defineProperties(video, { videoWidth: { value: 2 }, videoHeight: { value: 1 } });

const FRAME: VisionFrame = { width: 2, height: 1, timestamp: 9, people: [] };

/** A proxy whose worker has loaded. */
const loadedProxy = async () => {
  const proxy = new VisionWorkerProxy(DEFAULT_APP_CONFIG);
  const loading = proxy.load();
  FakeWorker.latest.answer({ type: "loaded" });
  await loading;
  return proxy;
};

beforeEach(() => {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => bitmap),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("VisionWorkerProxy", () => {
  it("starts a module worker and sends it the config to load", async () => {
    await loadedProxy();
    expect(FakeWorker.latest.options).toEqual({ type: "module" });
    expect(FakeWorker.latest.sent[0].request).toEqual({ type: "load", config: DEFAULT_APP_CONFIG });
  });

  it("fails to load when the worker reports an error", async () => {
    const loading = new VisionWorkerProxy(DEFAULT_APP_CONFIG).load();
    FakeWorker.latest.answer({ type: "error", message: "no GPU" });
    await expect(loading).rejects.toThrow("no GPU");
  });

  it("hands each frame to the worker as a transferred bitmap, and resolves with the tracked frame", async () => {
    const proxy = await loadedProxy();
    const detecting = proxy.detect(video, 9);
    await vi.waitFor(() => expect(FakeWorker.latest.sent).toHaveLength(2));

    expect(FakeWorker.latest.sent[1]).toEqual({
      request: { type: "detect", bitmap, timestamp: 9 },
      transfer: [bitmap],
    });
    FakeWorker.latest.answer({ type: "frame", frame: FRAME });
    expect(await detecting).toEqual(FRAME);
  });

  it("rejects a frame the worker could not track", async () => {
    const proxy = await loadedProxy();
    const detecting = proxy.detect(video, 9);
    await vi.waitFor(() => expect(FakeWorker.latest.sent).toHaveLength(2));
    FakeWorker.latest.answer({ type: "error", message: "lost the GPU" });
    await expect(detecting).rejects.toThrow("lost the GPU");
  });

  it("rejects a second request while one is waiting", async () => {
    const proxy = await loadedProxy();
    void proxy.detect(video, 1).catch(() => undefined);
    await vi.waitFor(() => expect(FakeWorker.latest.sent).toHaveLength(2));
    await expect(proxy.detect(video, 2)).rejects.toThrow("busy");
  });

  it("tells the worker to dispose, and rejects a frame still waiting", async () => {
    const proxy = await loadedProxy();
    const detecting = proxy.detect(video, 9);
    await vi.waitFor(() => expect(FakeWorker.latest.sent).toHaveLength(2));

    proxy.dispose();

    expect(FakeWorker.latest.sent[2].request).toEqual({ type: "dispose" });
    await expect(detecting).rejects.toThrow("disposed");
    await expect(proxy.detect(video, 10)).rejects.toThrow("not running");
  });
});
