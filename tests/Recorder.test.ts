import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";
import { Recorder, type FrameToRecord, type VideoRecorder } from "../src/debug/Recorder";
import { RECORDING_JSON, type Recording } from "../src/debug/RecordingFormat";
import { noKeyPoints } from "../src/vision/VisionTypes";

/** A video recorder that starts when told to, and records a fixed few bytes. */
class FakeVideo implements VideoRecorder {
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
    video.began();
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
    expect(recording.config.recordingMaxSeconds).toBe(DEFAULT_APP_CONFIG.recordingMaxSeconds);
  });

  it("keeps no frames before the video starts, or after it stops", async () => {
    recorder.start(video, CONTEXT);
    recorder.addFrame(frameAt(1000));
    video.began();
    recorder.addFrame(frameAt(1010));
    await recorder.stop();
    recorder.addFrame(frameAt(1020));

    expect(recordingIn(await unzipped()).frames.map(({ timestamp }) => timestamp)).toEqual([1010]);
  });

  it("holds a stopped recording, and discards it when another starts", async () => {
    recorder.start(video, CONTEXT);
    video.began();
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
    video.began();
    await recorder.stop();

    await recorder.download();
    expect(click).toHaveBeenCalledOnce();
    expect(recorder.state).toBe("idle");
  });

  it("stops itself at the longest length", async () => {
    const changes = vi.fn();
    recorder.subscribe(changes);
    recorder.start(video, CONTEXT);
    video.began();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(recorder.state).toBe("held");
    expect(video.stopped).toBe(1);
    expect(changes).toHaveBeenCalledTimes(3); // started, video began, stopped
  });

  it("times the recording from the video's start", () => {
    recorder.start(video, CONTEXT);
    expect(recorder.elapsedMs).toBe(0);
    video.began();
    now += 2500;
    expect(recorder.elapsedMs).toBe(2500);
  });
});
