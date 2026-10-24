import { useEffect, useRef, useState, type RefObject } from "react";
import type { AppConfig } from "../../config/AppConfig";
import useAppConfig from "../../providers/AppConfigHook";
import { createVisionModel } from "../../vision/createVisionModel";
import type { FootstepsVisionModelImplementation } from "../../vision/FootstepsVisionModelImplementation";
import { PersonTracker } from "../../vision/Tracking";
import type { VisionFrame } from "../../vision/VisionTypes";
import { feetOf, type FeetPositions } from "./CameraSupport";
import { drawPeople, type MaskType } from "./DrawPeople";
import { FrameStatsRecorder, type FrameStats } from "./FrameStats";
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

/** What the tracking loop reports to, and how it draws. */
type LoopHandlers = Pick<
  CharacterCanvasProps,
  "offScreenThreshold_percent" | "onFeetPositionsChange" | "onPlayersChange"
> & {
  maskType: MaskType;
  /** Keeps player ids stable and smooths key points between frames. */
  smoothing: boolean;
  /** Called at most every {@link STATS_INTERVAL_MS} with the loop's speed; omitted when nobody is looking. */
  onStats?: (stats: FrameStats) => void;
};

/**
 * Tracks the people in each video frame: reports players and feet, then draws their silhouettes.
 * @returns a function that stops the loop
 */
const startTrackingLoop = (
  model: FootstepsVisionModelImplementation,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  { offScreenThreshold_percent, onFeetPositionsChange, onPlayersChange, maskType, smoothing, onStats }: LoopHandlers,
): (() => void) => {
  let cancelled = false;
  let cancelFrame = () => {};
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const recorder = new FrameStatsRecorder();
  const tracker = smoothing ? new PersonTracker() : null;
  let statsShownAt = 0;

  const trackOnce = async () => {
    const timestamp = performance.now();
    const detected = await model.detect(video, timestamp);
    if (cancelled) return; // the model may have been disposed while this frame was tracked
    const inferenceEnd = performance.now();
    recorder.record(timestamp, inferenceEnd, detected.people.length);
    const current = recorder.stats();
    if (onStats && current && inferenceEnd - statsShownAt >= STATS_INTERVAL_MS) {
      statsShownAt = inferenceEnd;
      onStats(current);
    }
    const frame = tracker ? tracker.update(detected) : detected;
    const players = playersOf(frame, offScreenThreshold_percent);
    onPlayersChange?.(players, timestamp);
    onFeetPositionsChange?.(feetPositionsOf(players));
    // The 2D context is missing in some environments (eg. tests); the reports above still happen
    if (ctx) await drawPeople(video, frame, ctx, maskType);
  };

  // A failed frame is skipped rather than ending the loop; only the first failure is logged, as it may repeat every frame
  let warned = false;
  const trackFrame = async () => {
    if (cancelled) return;
    try {
      await trackOnce();
    } catch (error) {
      if (!warned) console.warn("Skipped a camera frame that could not be tracked:", error);
      warned = true;
    }
    if (!cancelled) cancelFrame = onNextFrame(video, trackFrame);
  };

  trackFrame();
  return () => {
    cancelled = true;
    cancelFrame();
  };
};

/** The loop's frame rate and inference time; benchmarks read the data attributes. */
const FrameStatsReadout = ({ stats }: { stats: FrameStats }) => (
  <output
    className="vision-stats"
    data-fps={stats.fps.toFixed(1)}
    data-inference-ms={stats.inferenceMs.toFixed(1)}
    data-people={stats.people}
    style={{ position: "absolute", top: 0, left: 0, padding: "2px 6px", background: "#000a", color: "#fff" }}
  >
    {stats.fps.toFixed(1)} fps · {stats.inferenceMs.toFixed(0)} ms · {stats.people} people
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
  const model = useVisionModel(loopProps.mediaStream, config);
  const smoothing = config.visionSmoothing;
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
      maskType,
      smoothing,
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
    smoothing,
    showStats,
  ]);

  return (
    <>
      <canvas ref={canvas} className={className} style={style} />
      {showStats && stats && <FrameStatsReadout stats={stats} />}
    </>
  );
}
