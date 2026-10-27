import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { AppConfig } from "../../config/AppConfig";
import useAppConfig from "../../providers/AppConfigHook";
import { createVisionModel } from "../../vision/createVisionModel";
import type { FootstepsVisionModelImplementation } from "../../vision/FootstepsVisionModelImplementation";
import { PersonTracker } from "../../vision/Tracking";
import type { VisionFrame } from "../../vision/VisionTypes";
import { feetOf, type FeetPositions } from "./CameraSupport";
import { drawPeople, type DrawStyle, type MaskType } from "./DrawPeople";
import { frameQuality, FrameStatsRecorder, type FrameStats, type FrameSteps } from "./FrameStats";
import { setTrackingFps } from "./TrackingFpsStore";
import type { PlayerFrame } from "./PlayerMonitor";

/** Props for {@link CharacterCanvas}. */
interface CharacterCanvasProps {
  /** The webcam video to track players in. */
  video: HTMLVideoElement | null;
  /** The webcam stream; the model is only loaded while there is one. */
  mediaStream: MediaStream | undefined;
  /** Feet lower than this (% of frame height) count as off screen and are not reported. */
  offScreenThreshold_percent?: number;
  /** Called every frame with the feet of everyone found (empty if nobody is). */
  onFeetPositionsChange?: (feetPositions: FeetPositions) => void;
  /**
   * Called every frame with the people found (empty if nobody is) and when the frame was taken, in milliseconds.
   *
   * NB. Keep this callback stable: a new one restarts the tracking loop.
   */
  onPlayersChange?: (players: PlayerFrame[], timestamp: number) => void;
  /** The canvas element, for callers that need its position on the page; an internal ref is used when omitted. */
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  className?: string;
  style?: React.CSSProperties;
  /** How to draw the silhouette; see {@link drawPeople}. Defaults to "binary". */
  maskType?: MaskType;
  /** Shows the loop's frame rate and inference time, which benchmarks also read from its data attributes. */
  showStats?: boolean;
}

/** How often the stats readout updates, in milliseconds; every frame would re-render too often. */
const STATS_INTERVAL_MS = 500;

/** Holds the configured vision model while there is a camera stream, and releases it when there isn't. */
const useVisionModel = (
  mediaStream: MediaStream | undefined,
  config: AppConfig,
): FootstepsVisionModelImplementation | null => {
  const [model, setModel] = useState<FootstepsVisionModelImplementation | null>(null);

  useEffect(() => {
    if (!mediaStream) return;
    const created = createVisionModel(config);
    let cancelled = false;
    created
      .load()
      .then(() => {
        if (!cancelled) setModel(created);
      })
      // A model disposed while loading (eg. by React's development double mount) fails to load on purpose
      .catch((error: unknown) => cancelled || console.error("Failed to load the vision model:", error));
    return () => {
      cancelled = true;
      created.dispose();
      setModel(null);
    };
  }, [mediaStream, config]);

  return model;
};

/** Each person in the frame, with their feet, for the interaction monitors. */
const playersOf = ({ width, height, people }: VisionFrame, offScreenThreshold_percent?: number): PlayerFrame[] =>
  people.map((person) => ({
    ...person,
    width,
    height,
    feet: feetOf(person, width, height, offScreenThreshold_percent),
  }));

/** The feet of the players that are on screen, keyed by player id. */
const feetPositionsOf = (players: PlayerFrame[]): FeetPositions => {
  const feetPositions: FeetPositions = {};
  for (const { id, feet } of players) {
    if (feet) feetPositions[id] = feet;
  }
  return feetPositions;
};

/**
 * Calls back once per new video frame where the browser supports it, so a 30fps camera isn't tracked twice per
 * frame on a 60–120Hz display; otherwise once per animation frame.
 * @returns a function that cancels the pending callback
 */
const onNextFrame = (video: HTMLVideoElement, callback: () => void): (() => void) => {
  if ("requestVideoFrameCallback" in video) {
    const handle = video.requestVideoFrameCallback(callback);
    return () => video.cancelVideoFrameCallback(handle);
  }
  const handle = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(handle);
};

/**
 * Tracks the people in a video frame, giving the model a scaled-down copy when the video is wider than `inputWidth`.
 * Masks come back at the size of the frame given, so a smaller frame makes every per-pixel step after the model
 * cheaper too; the silhouettes are scaled back up when drawn.
 */
const detectFrame = async (
  model: FootstepsVisionModelImplementation,
  video: HTMLVideoElement,
  inputWidth: number,
  timestamp: number,
): Promise<VisionFrame> => {
  if (inputWidth <= 0 || video.videoWidth <= inputWidth) return model.detect(video, timestamp);
  const resizeHeight = Math.round((video.videoHeight * inputWidth) / video.videoWidth);
  const bitmap = await createImageBitmap(video, { resizeWidth: inputWidth, resizeHeight, resizeQuality: "medium" });
  try {
    return await model.detect(bitmap, timestamp);
  } finally {
    bitmap.close(); // harmless if the bitmap was handed to a worker
  }
};

/** What the tracking loop reports to, and how it draws. */
type LoopHandlers = Pick<
  CharacterCanvasProps,
  "offScreenThreshold_percent" | "onFeetPositionsChange" | "onPlayersChange"
> & {
  /** How the silhouettes are drawn. */
  drawStyle: DrawStyle;
  /** Keeps player ids stable and smooths key points between frames. */
  smoothing: boolean;
  /** The widest frame the model is given; see {@link detectFrame}. */
  inputWidth: number;
  /** Called at most every {@link STATS_INTERVAL_MS} with the loop's speed; omitted when nobody is looking. */
  onStats?: (stats: FrameStats) => void;
};

/**
 * Records each frame's timings, and reports the loop's speed at most every {@link STATS_INTERVAL_MS}.
 * @returns a function to call once per frame, after it has been drawn
 */
const statsReporter = (onStats?: (stats: FrameStats) => void) => {
  const recorder = new FrameStatsRecorder();
  let shownAt = 0;
  return (frame: VisionFrame, start: number, inferenceEnd: number, steps: FrameSteps) => {
    recorder.record(start, inferenceEnd, steps);
    const timing = recorder.timing();
    const now = performance.now();
    if (!timing || now - shownAt < STATS_INTERVAL_MS) return;
    shownAt = now;
    setTrackingFps(timing.fps);
    onStats?.({ ...timing, ...frameQuality(frame) });
  };
};

/** A frame given to the model. */
interface Detection {
  /** When the frame was taken, in milliseconds. */
  timestamp: number;
  /** What the model found, and when it returned. */
  result: Promise<{ detected: VisionFrame; inferenceEnd: number }>;
}

/**
 * Each model's frame in progress, so a loop that replaces another (eg. when the mask type changes) waits for the old
 * loop's frame rather than asking a model that is busy.
 */
const modelWork = new WeakMap<FootstepsVisionModelImplementation, Promise<unknown>>();

/**
 * Gives the model the video's frames, one at a time: each call to `next` gives it the newest frame at once if the model
 * hasn't had it, or else the next frame as it arrives. So a failed frame waits for a new one, rather than retrying.
 * @returns how to give the model the next frame, and how to stop
 */
const videoDetections = (model: FootstepsVisionModelImplementation, video: HTMLVideoElement, inputWidth: number) => {
  let cancelled = false;
  let cancelFrame: (() => void) | undefined;
  let newFrame = true;
  let onNewFrame: (() => void) | undefined;

  const watchFrames = () => {
    cancelFrame = onNextFrame(video, () => {
      if (cancelled) return;
      newFrame = true;
      onNewFrame?.();
      watchFrames();
    });
  };
  watchFrames();

  const detect = (): Detection => {
    newFrame = false;
    onNewFrame = undefined;
    const timestamp = performance.now();
    const work = async () => {
      try {
        return { detected: await detectFrame(model, video, inputWidth, timestamp), inferenceEnd: performance.now() };
      } finally {
        if (modelWork.get(model) === result) modelWork.delete(model);
      }
    };
    // Straight to the model when it is free, so it starts before the loop reports the frame before
    const previous = modelWork.get(model);
    const result = previous ? previous.then(work, work) : work();
    modelWork.set(model, result);
    result.catch(() => undefined); // a failure is handled where the loop awaits it, after the frame before is drawn
    return { timestamp, result };
  };

  const next = (): Promise<Detection> =>
    newFrame ? Promise.resolve(detect()) : new Promise((resolve) => (onNewFrame = () => resolve(detect())));

  const cancel = () => {
    cancelled = true;
    cancelFrame?.();
  };
  return { next, cancel };
};

/**
 * Tracks the people in each video frame: reports players and feet, then draws their silhouettes.
 *
 * The loop is pipelined: as soon as the model returns a frame, it is given the next one, and the frame it returned is
 * reported and drawn while it works. Only one frame is with the model at a time.
 * @returns a function that stops the loop
 */
const startTrackingLoop = (
  model: FootstepsVisionModelImplementation,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  {
    offScreenThreshold_percent,
    onFeetPositionsChange,
    onPlayersChange,
    drawStyle,
    smoothing,
    inputWidth,
    onStats,
  }: LoopHandlers,
): (() => void) => {
  let cancelled = false;
  const detections = videoDetections(model, video, inputWidth);
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const reportStats = statsReporter(onStats);
  const tracker = smoothing ? new PersonTracker() : null;

  const reportAndDraw = (timestamp: number, detected: VisionFrame, inferenceEnd: number) => {
    const frame = tracker ? tracker.update(detected) : detected;
    const players = playersOf(frame, offScreenThreshold_percent);
    const trackEnd = performance.now();
    onPlayersChange?.(players, timestamp);
    onFeetPositionsChange?.(feetPositionsOf(players));
    const monitorEnd = performance.now();
    // The 2D context is missing in some environments (eg. tests); the reports above still happen
    if (ctx) drawPeople(video, frame, ctx, drawStyle);
    reportStats(frame, timestamp, inferenceEnd, {
      trackMs: trackEnd - inferenceEnd,
      monitorMs: monitorEnd - trackEnd,
      drawMs: performance.now() - monitorEnd,
    });
  };

  // A failed frame is skipped rather than ending the loop; only the first failure is logged, as it may repeat every frame
  let warned = false;
  const run = async (detection: Promise<Detection>) => {
    let next: Promise<Detection> | undefined;
    try {
      const { timestamp, result } = await detection;
      const { detected, inferenceEnd } = await result;
      if (cancelled) return; // the model may have been disposed while this frame was tracked
      next = detections.next();
      reportAndDraw(timestamp, detected, inferenceEnd);
    } catch (error) {
      // A frame cut short by the loop stopping (eg. the model disposed) is expected, not a failure
      if (!warned && !cancelled) console.warn("Skipped a camera frame that could not be tracked:", error);
      warned = true;
    }
    if (!cancelled) run(next ?? detections.next());
  };

  run(detections.next());
  return () => {
    cancelled = true;
    setTrackingFps(null);
    detections.cancel();
  };
};

/** The loop's frame rate and inference time; benchmarks read the data attributes. */
const FrameStatsReadout = ({ stats }: { stats: FrameStats }) => (
  <output
    className="vision-stats"
    data-fps={stats.fps.toFixed(1)}
    data-inference-ms={stats.inferenceMs.toFixed(1)}
    data-track-ms={stats.trackMs.toFixed(1)}
    data-monitor-ms={stats.monitorMs.toFixed(1)}
    data-draw-ms={stats.drawMs.toFixed(1)}
    data-people={stats.people}
    data-hands={stats.hands}
    data-feet={stats.feet}
    data-coverage={stats.coverage.toFixed(1)}
    data-reach={stats.reach.toFixed(1)}
    style={{ position: "absolute", top: 0, left: 0, padding: "2px 6px", background: "#000a", color: "#fff" }}
  >
    {stats.fps.toFixed(1)} fps · {stats.inferenceMs.toFixed(0)} ms · {stats.people} people · {stats.hands} hands ·{" "}
    {stats.feet} feet
  </output>
);

/**
 * Runs the configured vision model on the webcam video every frame, draws the players' silhouettes on a canvas,
 * and reports where each person is.
 */
export default function CharacterCanvas({
  canvasRef,
  className,
  style,
  maskType = "binary",
  showStats = false,
  ...loopProps
}: CharacterCanvasProps) {
  const config = useAppConfig();
  // Debug and feathering only change how players are drawn, so changing them keeps the loaded model
  const modelKey = JSON.stringify({ ...config, debug: false, cameraFeatherPx: 0 });
  const modelConfig = useMemo(() => JSON.parse(modelKey) as AppConfig, [modelKey]);
  const model = useVisionModel(loopProps.mediaStream, modelConfig);
  const smoothing = config.visionSmoothing;
  const inputWidth = config.visionInputWidth;
  const featherPx = config.cameraFeatherPx;
  const [stats, setStats] = useState<FrameStats | null>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvas = canvasRef ?? internalCanvasRef;
  const { video, mediaStream, offScreenThreshold_percent, onFeetPositionsChange, onPlayersChange } = loopProps;

  // The stream belongs to CharacterCamera, which stops its tracks; this effect only stops its own loop
  useEffect(() => {
    const canvasElement = canvas.current;
    if (!model || !video || !mediaStream || !canvasElement) return;
    const onStats = showStats ? setStats : undefined;
    const handlers = {
      offScreenThreshold_percent,
      onFeetPositionsChange,
      onPlayersChange,
      drawStyle: { maskType, featherPx },
      smoothing,
      inputWidth,
      onStats,
    };
    return startTrackingLoop(model, video, canvasElement, handlers);
  }, [
    model,
    mediaStream,
    video,
    canvas,
    onFeetPositionsChange,
    onPlayersChange,
    offScreenThreshold_percent,
    maskType,
    featherPx,
    smoothing,
    inputWidth,
    showStats,
  ]);

  return (
    <>
      <canvas ref={canvas} className={className} style={style} />
      {showStats && stats && <FrameStatsReadout stats={stats} />}
    </>
  );
}
