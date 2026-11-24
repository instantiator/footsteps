import { strToU8, zipSync } from "fflate";
import _ from "lodash";
import { describe, expect, it } from "vitest";
import { frameAt, readRecording, scenesAt } from "../src/debug/Replay";
import { RECORDING_JSON } from "../src/debug/RecordingFormat";

/** A frame at a time in the video, with nobody in it. */
const frameAtMs = (index: number, videoMs: number) => ({
  index,
  timestamp: 1000 + videoMs,
  videoMs,
  inferenceMs: 20,
  width: 2,
  height: 2,
  detected: [],
  players: [],
});

/** A zipped recording with the given `recording.json`. */
const zipOf = (json: object) =>
  zipSync({ [RECORDING_JSON]: strToU8(JSON.stringify(json)), "video.webm": new Uint8Array([1]) });

const RECORDING = {
  version: 1,
  recordedAt: "2026-11-24T00:00:00.000Z",
  config: {},
  video: "video.webm",
  videoType: "video/webm",
  labels: [],
  scenes: [
    { fromMs: 0, game: "demo", scenes: "title" },
    { fromMs: 500, game: "demo", scenes: "pits" },
  ],
  frames: [frameAtMs(0, 40), frameAtMs(1, 120), frameAtMs(2, 200)].map((frame) => ({
    ...frame,
    states: { 1: "active" },
  })),
};

describe("readRecording", () => {
  it("reads a recording and its files", () => {
    const { recording, files } = readRecording(zipOf(RECORDING));
    expect(recording.frames).toHaveLength(3);
    expect(recording.frames[0].states).toEqual({ 1: "active" });
    expect([...files["video.webm"]]).toEqual([1]);
  });

  it("reads one recorded before scenes and players' states were, as having none", () => {
    const first = { ..._.omit(RECORDING, "scenes"), frames: RECORDING.frames.map((frame) => _.omit(frame, "states")) };
    const { recording } = readRecording(zipOf(first));
    expect(recording.scenes).toEqual([]);
    expect(recording.frames.map(({ states }) => states)).toEqual([{}, {}, {}]);
  });

  it("refuses a zip that isn't a recording", () => {
    expect(() => readRecording(zipSync({ "other.txt": strToU8("hello") }))).toThrow(/Not a debug recording/);
  });
});

describe("frameAt and scenesAt", () => {
  const { recording } = readRecording(zipOf(RECORDING));

  it("finds the frame the game was working on at a time: the last given to the model by then", () => {
    expect(frameAt(recording, 20)).toBeUndefined();
    expect(frameAt(recording, 40)?.index).toBe(0);
    expect(frameAt(recording, 199)?.index).toBe(1);
    expect(frameAt(recording, 5000)?.index).toBe(2);
  });

  it("finds the scenes showing at a time", () => {
    expect(scenesAt(recording, 499)?.scenes).toBe("title");
    expect(scenesAt(recording, 500)?.scenes).toBe("pits");
  });
});
