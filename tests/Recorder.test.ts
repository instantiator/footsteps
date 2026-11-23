import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";
import { Recorder, type FrameToRecord } from "../src/debug/Recorder";
import { RECORDING_JSON, type Recording } from "../src/debug/RecordingFormat";
import { noKeyPoints } from "../src/vision/VisionTypes";
import { FakeVideo } from "./data/FakeVideo";

const CONTEXT = { config: DEFAULT_APP_CONFIG };

/** A 2×2 frame with one person, whose mask and strays are given. */
const frameAt = (timestamp: number, mask = [1, 1, 0, 0], strays?: number[]): FrameToRecord => ({
  timestamp,
  inferenceMs: 20,
  detected: {
    width: 2,
    height: 2,
    timestamp,
    people: [
      {
        id: 7,
        mask: new Uint8Array(mask),
        keyPoints: noKeyPoints(),
        scale: 3,
        strays: strays && new Uint8Array(strays),
      },
    ],
  },
  players: [{ id: 1, number: 1, role: "player", offBy: 0, keyPoints: noKeyPoints() }],
  states: { 1: "active", 2: "removed" },
});

describe("Recorder", () => {
  let now = 0;
  let video: FakeVideo;
  let recorder: Recorder;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1000;
    video = new FakeVideo();
    recorder = new Recorder({ maxMs: 60_000, now: () => now });
  });
  afterEach(() => vi.useRealTimers());

  const unzipped = async () => unzipSync(new Uint8Array(await (await recorder.zip())!.arrayBuffer()));
  const recordingIn = (files: Record<string, Uint8Array>): Recording => JSON.parse(strFromU8(files[RECORDING_JSON]));

  it("zips the video, each frame's masks, and the frames timed from the video's start", async () => {
    recorder.start(video, CONTEXT);
    recorder.addFrame(frameAt(1040, [1, 0, 0, 1], [0, 1, 0, 0]));
    recorder.addFrame(frameAt(1080));
    await recorder.stop();

    const files = await unzipped();
    const recording = recordingIn(files);
    expect(recording.video).toBe("video.webm");
    expect([...files["video.webm"]]).toEqual([1, 2, 3]);
    expect(recording.frames.map(({ index, videoMs }) => [index, videoMs])).toEqual([
      [0, 40],
      [1, 80],
    ]);
    const [first, second] = recording.frames;
    expect([...files[first.detected[0].mask]]).toEqual([1, 0, 0, 1]);
    expect([...files[first.detected[0].strays!]]).toEqual([0, 1, 0, 0]);
    expect(second.detected[0].strays).toBeUndefined();
    expect(first.players[0]).toMatchObject({ id: 1, role: "player" });
    expect(first.states).toEqual({ 1: "active", 2: "removed" });
    expect(recording.config.recordingMaxSeconds).toBe(DEFAULT_APP_CONFIG.recordingMaxSeconds);
  });

  it("notes the scenes showing as it starts, and each change while it runs, timed from the video's start", async () => {
    const [title, pits] = [
      { game: "demo", scenes: '{"overview":"title"}' },
      { game: "demo", scenes: '{"stage":"pits"}' },
    ];
    recorder.setScene(title);
    recorder.start(video, CONTEXT);
    now = 1500;
    recorder.setScene(pits);
    await recorder.stop();
    recorder.setScene(title);

    expect(recordingIn(await unzipped()).scenes).toEqual([
      { ...title, fromMs: 0 },
      { ...pits, fromMs: 500 },
    ]);
  });

  it("keeps no frames after it stops", async () => {
    recorder.start(video, CONTEXT);
    recorder.addFrame(frameAt(1010));
    await recorder.stop();
    recorder.addFrame(frameAt(1020));

    expect(recordingIn(await unzipped()).frames.map(({ timestamp }) => timestamp)).toEqual([1010]);
  });

  it("holds a stopped recording, and discards it when another starts", async () => {
    recorder.start(video, CONTEXT);
    await recorder.stop();
    expect(recorder.state).toBe("held");

    recorder.start(video, CONTEXT);
    expect(recorder.state).toBe("recording");
    expect(await recorder.zip()).toBeUndefined();
  });

  it("discards the recording once downloaded", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:recording");
    URL.revokeObjectURL = vi.fn();
    recorder.start(video, CONTEXT);
    await recorder.stop();

    await recorder.download();
    expect(click).toHaveBeenCalledOnce();
    expect(recorder.state).toBe("idle");
  });

  it("stops itself at the longest length", async () => {
    const changes = vi.fn();
    recorder.subscribe(changes);
    recorder.start(video, CONTEXT);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(recorder.state).toBe("held");
    expect(video.stopped).toBe(1);
    expect(changes).toHaveBeenCalledTimes(2); // started, stopped
  });

  it("times the recording from its start", () => {
    expect(recorder.elapsedMs).toBe(0);
    recorder.start(video, CONTEXT);
    now += 2500;
    expect(recorder.elapsedMs).toBe(2500);
  });
});
