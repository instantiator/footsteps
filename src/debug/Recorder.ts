import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import type { VisionFrame } from "../vision/VisionTypes";
import {
  RECORDING_JSON,
  RECORDING_VERSION,
  type RecordedFrameEntry,
  type RecordedPlayer,
  type RecordedScene,
  type Recording,
  type RecordingContext,
} from "./RecordingFormat";

/** Records a video, of the camera or the screen; {@link mediaVideoRecorder} in the browser, a fake in tests. */
export interface VideoRecorder {
  /** The video's MIME type. */
  readonly mimeType: string;
  /** Starts recording. */
  start(): void;
  /** Stops recording. @returns the whole video */
  stop(): Promise<Blob>;
}

/** Records a stream with the browser's `MediaRecorder`, in whichever format it records best. */
export const mediaVideoRecorder = (stream: MediaStream): VideoRecorder => {
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = ({ data }) => {
    if (data.size > 0) chunks.push(data);
  };
  return {
    get mimeType() {
      return recorder.mimeType;
    },
    start: () => recorder.start(1000),
    stop: () =>
      new Promise((resolve) => {
        const whole = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
        // A recorder whose stream has ended (eg. screen sharing stopped from the browser's bar) has stopped already
        if (recorder.state === "inactive") return whole();
        recorder.onstop = whole;
        recorder.stop();
      }),
  };
};

/**
 * Records the game's screen, after asking the player to share this tab; undefined if they don't. The sharing ends
 * with the recording.
 */
export const screenVideoRecorder = async (): Promise<VideoRecorder | undefined> => {
  // `preferCurrentTab` (Chrome) offers this tab first; other browsers ignore it
  const options: DisplayMediaStreamOptions & { preferCurrentTab: boolean } = { video: true, preferCurrentTab: true };
  const stream = await navigator.mediaDevices.getDisplayMedia(options).catch((error: unknown) => {
    console.warn("The screen wasn't shared, so only the camera is recorded:", error);
    return undefined;
  });
  if (!stream) return undefined;
  const recorder = mediaVideoRecorder(stream);
  return {
    get mimeType() {
      return recorder.mimeType;
    },
    start: () => recorder.start(),
    stop: async () => {
      const video = await recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      return video;
    },
  };
};

/** One frame as the tracking loop saw it: the model's output, and the people it tracked. */
export interface FrameToRecord {
  /** When the frame was given to the model, in `performance.now()` milliseconds. */
  timestamp: number;
  /** How long the model took, in milliseconds. */
  inferenceMs: number;
  /** What the model found. */
  detected: VisionFrame;
  /** Everyone the game tracked. */
  players: RecordedPlayer[];
  /** Each known player's state, by id. */
  states: RecordedFrameEntry["states"];
}

/** The camera a recording would capture, and what to say about it when it starts. */
export interface RecordingSource {
  /** Starts recording the camera's video, eg. with {@link mediaVideoRecorder}. */
  video: () => VideoRecorder;
  /** Describes the camera and settings as recording starts. */
  describe: () => RecordingContext;
  /** Starts recording the screen too, if it is to be, eg. with {@link screenVideoRecorder}; undefined if not. */
  screen?: () => Promise<VideoRecorder | undefined>;
}

/** Whether nothing is recorded, a recording is running, or one is held to download. */
export type RecorderState = "idle" | "recording" | "held";

/** What the recorder is made with. */
export interface RecorderOptions {
  /** The longest a recording runs before it stops itself, in milliseconds. */
  maxMs: number;
  /** The clock frames are timed by. */
  now?: () => number;
}

/** A recording in progress or held: its zip so far, its frames, and its video. */
interface Take {
  context: RecordingContext;
  recordedAt: string;
  video: VideoRecorder;
  /** The screen's video, if it is recorded too. */
  screen?: VideoRecorder;
  startedAt: number;
  frames: RecordedFrameEntry[];
  scenes: RecordedScene[];
  zip: Zip;
  chunks: Uint8Array<ArrayBuffer>[];
  blob?: Blob;
  screenBlob?: Blob;
  stopTimer: ReturnType<typeof setTimeout>;
}

/** A mask's name in the zip: by frame, then person. */
const maskPath = (index: number, id: number, suffix = ""): string =>
  `masks/${String(index).padStart(6, "0")}-${id}${suffix}.bin`;

/** A video's name in the zip, by its type. */
const videoPath = (mimeType: string, name = "video"): string => `${name}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;

/** Adds one file to a zip, deflated or stored as-is. */
const addFile = (zip: Zip, path: string, data: Uint8Array, deflate = true) => {
  const file = deflate ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
  zip.add(file);
  file.push(data, true);
};

/**
 * Records the camera, and what the game made of each frame it processed, for debugging and replay tests.
 *
 * One recording at a time: starting another or downloading discards the one held. Masks are compressed into the zip
 * as frames arrive, so a minute's recording stays a few tens of megabytes.
 */
export class Recorder {
  private take?: Take;
  private source?: RecordingSource;
  private scene?: Omit<RecordedScene, "fromMs">;
  private listeners = new Set<() => void>();
  private readonly options: Required<RecorderOptions>;

  constructor(options: RecorderOptions) {
    this.options = { now: () => performance.now(), ...options };
  }

  /** Whether nothing is recorded, a recording is running, or one is held. */
  get state(): RecorderState {
    if (!this.take) return "idle";
    return this.take.blob ? "held" : "recording";
  }

  /** How long the recording has run, in milliseconds. */
  get elapsedMs(): number {
    return this.take ? this.options.now() - this.take.startedAt : 0;
  }

  /** Calls back whenever the state changes. @returns a function that stops calling back */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Whether there is a camera to record. */
  get canRecord(): boolean {
    return this.source !== undefined;
  }

  /** Sets the camera to record, or none when it goes. A recording of a camera that goes is stopped and held. */
  setSource(source: RecordingSource | undefined) {
    this.source = source;
    if (!source) void this.stop();
    this.changed();
  }

  /** Notes the scenes now showing, so a recording says where each stretch of it was played. */
  setScene(scene: Omit<RecordedScene, "fromMs">) {
    this.scene = scene;
    const take = this.take;
    if (take && !take.blob) take.scenes.push({ ...scene, fromMs: this.elapsedMs });
  }

  /** Starts recording the camera, and the screen if the source records it, discarding any recording held. */
  async record() {
    const source = this.source;
    if (!source) return;
    // Asked first, as sharing the screen waits on the player
    const screen = await source.screen?.();
    this.start(source.video(), source.describe(), screen);
  }

  /**
   * Starts recording, discarding any recording held.
   * @param video records the camera, eg. {@link mediaVideoRecorder}
   * @param screen records the screen too, if given, from the same moment
   */
  start(video: VideoRecorder, context: RecordingContext, screen?: VideoRecorder) {
    this.discard();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    const zip = new Zip((error, chunk) => {
      if (!error) chunks.push(chunk.slice()); // a copy, typed as a plain buffer for the Blob
    });
    // Timed from the call rather than the recorder's start event, which comes a frame or more after its first frame
    video.start();
    screen?.start();
    const take: Take = {
      startedAt: this.options.now(),
      context,
      recordedAt: new Date().toISOString(),
      video,
      screen,
      frames: [],
      scenes: this.scene ? [{ ...this.scene, fromMs: 0 }] : [],
      zip,
      chunks,
      stopTimer: setTimeout(() => void this.stop(), this.options.maxMs),
    };
    this.take = take;
    this.changed();
  }

  /** Adds a processed frame while recording; ignored otherwise. */
  addFrame({ timestamp, inferenceMs, detected, players, states }: FrameToRecord) {
    const take = this.take;
    if (!take || take.blob) return;
    const index = take.frames.length;
    const people = detected.people.map(({ id, keyPoints, scale, mask, strays }) => {
      const masks = { mask: maskPath(index, id), strays: strays && maskPath(index, id, "-strays") };
      addFile(take.zip, masks.mask, mask);
      if (strays && masks.strays) addFile(take.zip, masks.strays, strays);
      return { id, keyPoints, scale, ...masks };
    });
    take.frames.push({
      index,
      timestamp,
      videoMs: timestamp - take.startedAt,
      inferenceMs,
      width: detected.width,
      height: detected.height,
      detected: people,
      players,
      states,
    });
  }

  /** Stops recording, and holds the recording to download. */
  async stop() {
    const take = this.take;
    if (!take || take.blob) return;
    clearTimeout(take.stopTimer);
    const [blob, screenBlob] = await Promise.all([take.video.stop(), take.screen?.stop()]);
    if (this.take !== take) return; // discarded while the video finished
    Object.assign(take, { blob, screenBlob });
    this.changed();
  }

  /** The held recording as a zip, or undefined if none is held. */
  async zip(): Promise<Blob | undefined> {
    const take = this.take;
    if (!take?.blob) return undefined;
    const video = videoPath(take.video.mimeType);
    const recording: Recording = {
      version: RECORDING_VERSION,
      recordedAt: take.recordedAt,
      ...take.context,
      video,
      videoType: take.video.mimeType,
      ...(take.screenBlob && take.screen && { screen: videoPath(take.screen.mimeType, "screen") }),
      labels: [],
      scenes: take.scenes,
      frames: take.frames,
    };
    addFile(take.zip, video, new Uint8Array(await take.blob.arrayBuffer()), false);
    if (take.screenBlob && recording.screen) {
      addFile(take.zip, recording.screen, new Uint8Array(await take.screenBlob.arrayBuffer()), false);
    }
    addFile(take.zip, RECORDING_JSON, strToU8(JSON.stringify(recording)));
    take.zip.end();
    return new Blob(take.chunks, { type: "application/zip" });
  }

  /** Saves the held recording as a zip, then discards it. */
  async download() {
    const zip = await this.zip();
    if (!zip) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zip);
    link.download = `footsteps-recording-${this.take?.recordedAt.replace(/[:.]/g, "-")}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.discard();
  }

  /** Drops the recording, stopping its video if it's still running. */
  discard() {
    const take = this.take;
    if (!take) return;
    this.take = undefined;
    clearTimeout(take.stopTimer);
    if (!take.blob) {
      void take.video.stop();
      void take.screen?.stop();
    }
    this.changed();
  }

  private changed() {
    this.listeners.forEach((listener) => listener());
  }
}
