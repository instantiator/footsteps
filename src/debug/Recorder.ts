import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import type { VisionFrame } from "../vision/VisionTypes";
import {
  RECORDING_JSON,
  RECORDING_VERSION,
  type RecordedFrameEntry,
  type RecordedPlayer,
  type Recording,
  type RecordingContext,
} from "./RecordingFormat";

/** Records the camera's video; {@link mediaVideoRecorder} in the browser, a fake in tests. */
export interface VideoRecorder {
  /** The video's MIME type. */
  readonly mimeType: string;
  /** Starts recording, calling back once the video's first moment is fixed. */
  start(onStarted: () => void): void;
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
    start: (onStarted) => {
      recorder.onstart = onStarted;
      recorder.start(1000);
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.stop();
      }),
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
  startedAt?: number;
  frames: RecordedFrameEntry[];
  zip: Zip;
  chunks: Uint8Array<ArrayBuffer>[];
  blob?: Blob;
  stopTimer: ReturnType<typeof setTimeout>;
}

/** A mask's name in the zip: by frame, then person. */
const maskPath = (index: number, id: number, suffix = ""): string =>
  `masks/${String(index).padStart(6, "0")}-${id}${suffix}.bin`;

/** The video's name in the zip, by its type. */
const videoPath = (mimeType: string): string => (mimeType.includes("mp4") ? "video.mp4" : "video.webm");

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

  /** How long the recording has run, in milliseconds; 0 until its video starts. */
  get elapsedMs(): number {
    const startedAt = this.take?.startedAt;
    return startedAt === undefined ? 0 : this.options.now() - startedAt;
  }

  /** Calls back whenever the state changes. @returns a function that stops calling back */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts recording, discarding any recording held. @param video records the camera, eg. {@link mediaVideoRecorder} */
  start(video: VideoRecorder, context: RecordingContext) {
    this.discard();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    const zip = new Zip((error, chunk) => {
      if (!error) chunks.push(chunk.slice()); // a copy, typed as a plain buffer for the Blob
    });
    const take: Take = {
      context,
      recordedAt: new Date().toISOString(),
      video,
      frames: [],
      zip,
      chunks,
      stopTimer: setTimeout(() => void this.stop(), this.options.maxMs),
    };
    this.take = take;
    video.start(() => {
      take.startedAt = this.options.now();
      this.changed();
    });
    this.changed();
  }

  /** Adds a processed frame while recording; ignored otherwise, or before the video has started. */
  addFrame({ timestamp, inferenceMs, detected, players }: FrameToRecord) {
    const take = this.take;
    if (!take || take.blob || take.startedAt === undefined) return;
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
    });
  }

  /** Stops recording, and holds the recording to download. */
  async stop() {
    const take = this.take;
    if (!take || take.blob) return;
    clearTimeout(take.stopTimer);
    const blob = await take.video.stop();
    if (this.take !== take) return; // discarded while the video finished
    take.blob = blob;
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
      labels: [],
      frames: take.frames,
    };
    addFile(take.zip, video, new Uint8Array(await take.blob.arrayBuffer()), false);
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
    if (!take.blob) void take.video.stop();
    this.changed();
  }

  private changed() {
    this.listeners.forEach((listener) => listener());
  }
}
