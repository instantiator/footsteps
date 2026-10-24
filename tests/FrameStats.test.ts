import { describe, expect, it } from "vitest";
import { FrameStatsRecorder } from "../src/components/camera/FrameStats";

describe("FrameStatsRecorder", () => {
  it("has no stats until two frames give it an interval", () => {
    const recorder = new FrameStatsRecorder();
    expect(recorder.stats()).toBeNull();
    recorder.record(0, 10);
    expect(recorder.stats()).toBeNull();
  });

  it("reports frames per second between the first and last frame, and the median inference time", () => {
    const recorder = new FrameStatsRecorder();
    recorder.record(0, 10); // 10ms
    recorder.record(90, 110); // 20ms
    recorder.record(150, 210); // 60ms, an outlier the median ignores
    expect(recorder.stats()).toEqual({ fps: 10, inferenceMs: 20 });
  });

  it("only covers the most recent thirty frames", () => {
    const recorder = new FrameStatsRecorder();
    for (let frame = 0; frame < 30; frame++) recorder.record(frame * 1000, frame * 1000 + 500); // slow frames
    for (let frame = 0; frame < 30; frame++) recorder.record(30_000 + frame * 10, 30_000 + frame * 10 + 5);
    expect(recorder.stats()).toEqual({ fps: 100, inferenceMs: 5 });
  });
});
