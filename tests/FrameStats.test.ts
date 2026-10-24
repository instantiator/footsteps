import { describe, expect, it } from "vitest";
import { frameQuality, FrameStatsRecorder } from "../src/components/camera/FrameStats";
import { noKeyPoints, type VisionPerson } from "../src/vision/VisionTypes";

describe("FrameStatsRecorder", () => {
  it("has no timing until two frames give it an interval", () => {
    const recorder = new FrameStatsRecorder();
    expect(recorder.timing()).toBeNull();
    recorder.record(0, 10);
    expect(recorder.timing()).toBeNull();
  });

  it("reports frames per second between the first and last frame, and the median inference time", () => {
    const recorder = new FrameStatsRecorder();
    recorder.record(0, 10); // 10ms
    recorder.record(90, 110); // 20ms
    recorder.record(150, 210); // 60ms, an outlier the median ignores
    expect(recorder.timing()).toEqual({ fps: 10, inferenceMs: 20 });
  });

  it("only covers the most recent thirty frames", () => {
    const recorder = new FrameStatsRecorder();
    for (let frame = 0; frame < 30; frame++) recorder.record(frame * 1000, frame * 1000 + 500); // slow frames
    for (let frame = 0; frame < 30; frame++) recorder.record(30_000 + frame * 10, 30_000 + frame * 10 + 5);
    expect(recorder.timing()).toEqual({ fps: 100, inferenceMs: 5 });
  });
});

describe("frameQuality", () => {
  /** A person in a 2×4 frame covering the given pixels. */
  const person = (pixels: number[], keyPoints: Partial<VisionPerson["keyPoints"]> = {}): VisionPerson => {
    const mask = new Uint8Array(8);
    for (const i of pixels) mask[i] = 1;
    return { id: 0, mask, keyPoints: { ...noKeyPoints(), ...keyPoints }, scale: 1 };
  };

  it("counts people, and the hands and feet they have placed", () => {
    const quality = frameQuality({
      width: 2,
      height: 4,
      timestamp: 0,
      people: [
        person([0], { leftHand: { x: 0, y: 0 }, leftFoot: { x: 0, y: 3 }, rightFoot: { x: 1, y: 3 } }),
        person([1], { rightHand: { x: 1, y: 0 } }),
      ],
    });
    expect(quality).toMatchObject({ people: 2, hands: 2, feet: 2 });
  });

  it("measures the frame the silhouettes cover, counting overlaps once, and how far down they reach", () => {
    // One person down to row 1 of 4 (50%), the other to row 3 (100%), overlapping at pixel 0
    const quality = frameQuality({ width: 2, height: 4, timestamp: 0, people: [person([0, 2]), person([0, 6])] });
    expect(quality.coverage).toBe(37.5); // pixels 0, 2 and 6 of 8
    expect(quality.reach).toBe(75);
  });

  it("is all zero for an empty frame", () => {
    expect(frameQuality({ width: 2, height: 4, timestamp: 0, people: [] })).toEqual({
      people: 0,
      hands: 0,
      feet: 0,
      coverage: 0,
      reach: 0,
    });
  });
});
