import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectTfBackend } from "../src/vision/models/TfBackend";

/** The mocked tfjs: which backends start, and which one is in use. */
const tf = vi.hoisted(() => {
  const state = { webgpuStarts: true, current: "cpu" };
  const setBackend = vi.fn(async (name: string) => {
    if (name === "webgpu" && !state.webgpuStarts) return false;
    state.current = name;
    return true;
  });
  return { state, setBackend, ready: vi.fn(async () => undefined), getBackend: vi.fn(() => state.current) };
});

vi.mock("@tensorflow/tfjs", () => ({ setBackend: tf.setBackend, ready: tf.ready, getBackend: tf.getBackend }));
vi.mock("@tensorflow/tfjs-backend-webgpu", () => ({}));

beforeEach(() => {
  tf.state.webgpuStarts = true;
  tf.state.current = "cpu";
  tf.setBackend.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("selectTfBackend", () => {
  it("uses WebGL when asked", async () => {
    expect(await selectTfBackend("webgl")).toBe("webgl");
    expect(tf.setBackend).toHaveBeenCalledWith("webgl");
  });

  it("uses WebGPU when asked and it starts", async () => {
    expect(await selectTfBackend("webgpu")).toBe("webgpu");
    expect(tf.setBackend).not.toHaveBeenCalledWith("webgl");
  });

  it("falls back to WebGL, with a warning, when WebGPU does not start", async () => {
    tf.state.webgpuStarts = false;
    expect(await selectTfBackend("webgpu")).toBe("webgl");
    expect(console.warn).toHaveBeenCalledWith("WebGPU is unavailable; using WebGL");
  });

  it("falls back to WebGL when starting WebGPU throws", async () => {
    tf.setBackend.mockRejectedValueOnce(new Error("no adapter"));
    expect(await selectTfBackend("webgpu")).toBe("webgl");
  });

  it("runs concurrent switches one at a time", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    tf.setBackend.mockImplementation(async (name: string) => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      tf.state.current = name;
      return true;
    });
    expect(await Promise.all([selectTfBackend("webgpu"), selectTfBackend("webgpu")])).toEqual(["webgpu", "webgpu"]);
    expect(maxInFlight).toBe(1);
  });
});
