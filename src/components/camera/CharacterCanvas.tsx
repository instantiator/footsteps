import { useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { DEFAULT_APP_CONFIG, type AppConfig } from "../../config/AppConfig";
import useAppConfig from "../../providers/AppConfigHook";
import { isDefined } from "../../util/ObjectUtils";
import { createVisionModel } from "../../vision/createVisionModel";
import type { FootstepsVisionModelImplementation } from "../../vision/FootstepsVisionModelImplementation";
import { PersonTracker, type HoldTimes } from "../../vision/Tracking";
import type { VisionFrame } from "../../vision/VisionTypes";
import type { Corners } from "./FloorGeometry";
import { feetOf } from "./CameraSupport";
import type { MaskType } from "./DrawPeople";
import { drawPlayers } from "./DrawPlayers";
import { frameQuality, FrameStatsRecorder, type FrameStats, type FrameSteps } from "./FrameStats";
import { PlayerCanvases } from "./PlayerCanvases";
import type { PlayerRegistry } from "./PlayerRegistry";
import { PlayerRegistryContext } from "../../providers/PlayerRegistryContext";
import { PlayerPositions, positionMapping, type PlayerPosition, type PositionSettings } from "./PlayerPosition";
import type { PlayerFrame } from "./PlayerMonitor";
import {
  describePeople,
  NO_SPECTATORS,
  RETURN_DISTANCE,
  SpectatorWatch,
  type PersonReadout,
  type SpectatorReport,
  type SpectatorSettings,
} from "./Spectators";
import { SpectatorsContext, type ShownSpectators } from "../../providers/SpectatorsContext";
import { placePlayers, type PlacementFloor, type VirtualSettings } from "./VirtualPlayers";
import { mediaVideoRecorder, type Recorder } from "../../debug/Recorder";
import { RecorderContext } from "../../debug/RecorderContext";
import type { RecordedPlayer } from "../../debug/RecordingFormat";

/** Props for {@link CharacterCanvas}. */
interface CharacterCanvasProps {
  /** The webcam video to track players in. */
  video: HTMLVideoElement | null;
  /** The webcam stream; the model is only loaded while there is one. */
  mediaStream: MediaStream | undefined;
  /** Feet lower than this (% of frame height) count as off screen and are not reported. */
  offScreenThreshold_percent?: number;
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
  /** Shows the loop's frame rate and the time each step takes, which benchmarks also read from its data attributes. */
  showStats?: boolean;
  /** Lists each person found, with whether they play or watch and why, for debugging who counts as a spectator. */
  showPeople?: boolean;
  /** The floor players stand on in a 2.5D scene; none in a 2D one. Changing it doesn't restart tracking. */
  floor?: Corners;
  /** Whether the canvas is shown flipped like a mirror, so positions run from the screen's left. */
  mirrored?: boolean;
}

/** A ref holding the latest value, for the tracking loop to read each frame without restarting. */
const useLatest = <T,>(value: T): RefObject<T> => {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
};

/** The floor players stand on now, for the tracking loop to read each frame. */
const usePlayersFloor = (floor: Corners | undefined, mirrored: boolean): RefObject<PlayersFloor> =>
  useLatest(
    useMemo(
      () => ({ toPosition: positionMapping(floor, mirrored), sorted: isDefined(floor), corners: floor, mirrored }),
      [floor, mirrored],
    ),
  );

/**
 * Offers the camera to the debug recorder while there is one, describing the camera, floor and settings as a
 * recording starts.
 */
const useRecordingSource = (
  recorder: Recorder | null,
  stream: MediaStream | undefined,
  about: { floor?: Corners; mirrored: boolean; config: AppConfig },
) => {
  const latest = useLatest(about);
  useEffect(() => {
    if (!recorder || !stream) return;
    const describe = () => {
      const { floor, mirrored, config } = latest.current;
      const track = stream.getVideoTracks()[0];
      const { width = 0, height = 0 } = track?.getSettings() ?? {};
      return { camera: { label: track?.label ?? "", width, height, mirror: mirrored }, floor, config };
    };
    recorder.setSource({ video: () => mediaVideoRecorder(stream), describe });
    return () => recorder.setSource(undefined);
  }, [recorder, stream, latest]);
};

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

/** Each person in the frame, with their feet and position, for the interaction monitors. */
const playersOf = (
  { width, height, people }: VisionFrame,
  positions: Map<number, PlayerPosition>,
  offScreenThreshold_percent?: number,
): PlayerFrame[] =>
  people.map((person) => ({
    ...person,
    width,
    height,
    feet: feetOf(person, width, height, offScreenThreshold_percent),
    position: positions.get(person.id)?.position ?? null,
  }));

/**
 * Calls back once per new video frame where the browser supports it, so a 30fps camera isn't tracked twice per
 * frame on a 60–120Hz scene; otherwise once per animation frame.
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
type LoopHandlers = Pick<CharacterCanvasProps, "offScreenThreshold_percent" | "onPlayersChange"> & {
  /** How the silhouettes are tinted. */
  maskType: MaskType;
  /** How the loop follows, holds and draws players. */
  settings: LoopSettings;
  /** Called at most every {@link STATS_INTERVAL_MS} with the loop's speed; omitted when nobody is looking. */
  onStats?: (stats: FrameStats) => void;
  /** Called at most every {@link STATS_INTERVAL_MS} with each person found; omitted when nobody is looking. */
  onPeople?: (people: PersonReadout[]) => void;
  /** The floor players stand on now, read each frame as scenes change. */
  floor: RefObject<PlayersFloor>;
  /** How spectators show now, and what their return does, read each frame as scenes change. */
  shownSpectators: RefObject<ShownSpectators>;
  /** The debug recorder, given each frame while it records. */
  recorder: Recorder | null;
};

/** How players' ground points become positions, and whether they are sorted among the foreground by them. */
interface PlayersFloor extends PlacementFloor {
  /** How a ground point becomes a position. */
  toPosition: ReturnType<typeof positionMapping>;
  /** Whether players sort among the foreground by depth, which they do on a floor. */
  sorted: boolean;
}

/** The app config settings the tracking loop uses. */
interface LoopSettings {
  /** Keeps player ids stable and smooths key points between frames. */
  smoothing: boolean;
  /** How long a player the model loses is still shown; needs smoothing. */
  hold: HoldTimes;
  /** Whether to fill parts of a player the model missed from the frame before; needs smoothing. */
  fillGaps: boolean;
  /** The widest frame the model is given; see {@link detectFrame}. */
  inputWidth: number;
  /** How far the silhouette's edges fade out, in canvas pixels. */
  featherPx: number;
  /** How a player's position follows them. */
  position: PositionSettings;
  /** Who counts as off the floor. */
  spectators: SpectatorSettings;
  /** How big players are drawn, and how far they move (a spike, off by default). */
  virtual: VirtualSettings;
}

/** The loop's settings from the app config, the same object until one of them changes. */
const useLoopSettings = (config: AppConfig): LoopSettings => {
  const { visionSmoothing, cameraHoldMs, cameraFadeMs, cameraFillGaps, visionInputWidth, cameraFeatherPx } = config;
  const { cameraDepthWindowMs, cameraDepthDeadband, spectatorMargin, spectatorHoldMs, spectatorReturnMs } = config;
  const { playerScale, motionGain } = config;
  return useMemo(
    () => ({
      smoothing: visionSmoothing,
      hold: { holdMs: cameraHoldMs, fadeMs: cameraFadeMs },
      fillGaps: cameraFillGaps,
      inputWidth: visionInputWidth,
      featherPx: cameraFeatherPx,
      position: { windowMs: cameraDepthWindowMs, deadband: cameraDepthDeadband },
      spectators: { margin: spectatorMargin, holdMs: spectatorHoldMs, returnMs: spectatorReturnMs },
      virtual: { playerScale, motionGain },
    }),
    [
      visionSmoothing,
      cameraHoldMs,
      cameraFadeMs,
      cameraFillGaps,
      visionInputWidth,
      cameraFeatherPx,
      cameraDepthWindowMs,
      cameraDepthDeadband,
      spectatorMargin,
      spectatorHoldMs,
      spectatorReturnMs,
      playerScale,
      motionGain,
    ],
  );
};

/** Settings that only change how players are drawn or held, not which model runs. */
const DRAWING_SETTINGS = [
  "debug",
  "cameraFeatherPx",
  "cameraHoldMs",
  "cameraFadeMs",
  "cameraFillGaps",
  "cameraDepthWindowMs",
  "cameraDepthDeadband",
  "spectatorMargin",
  "spectatorHoldMs",
  "spectatorReturnMs",
  "playerScale",
  "motionGain",
] as const;

/** The config the model is made from, the same object while only {@link DRAWING_SETTINGS} change, so the model is kept. */
const useModelConfig = (config: AppConfig): AppConfig => {
  const modelKey = JSON.stringify({
    ...config,
    ...Object.fromEntries(DRAWING_SETTINGS.map((key) => [key, DEFAULT_APP_CONFIG[key]])),
  });
  return useMemo(() => JSON.parse(modelKey) as AppConfig, [modelKey]);
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
    onStats?.({ ...timing, ...frameQuality(frame) });
  };
};

/** Sizes the canvases to the video, and starts following people afresh at its width. */
const sizeToVideo = (
  video: HTMLVideoElement,
  reference: HTMLCanvasElement,
  canvases: PlayerCanvases,
  registry: PlayerRegistry,
) => {
  reference.width = video.videoWidth;
  reference.height = video.videoHeight;
  canvases.resize();
  registry.resetTracking(video.videoWidth);
};

/** Reports each person found at most every {@link STATS_INTERVAL_MS}, working them out only when it does. */
const peopleReporter = (onPeople?: (people: PersonReadout[]) => void) => {
  let shownAt = 0;
  return (describe: () => PersonReadout[]) => {
    const now = performance.now();
    if (!onPeople || now - shownAt < STATS_INTERVAL_MS) return;
    shownAt = now;
    onPeople(describe());
  };
};

/** Tells the game when a spectator returned to the floor away from where they left it. */
const noteReturns = (watching: SpectatorReport, shown: ShownSpectators) => {
  if (watching.returned.some(({ distance }) => distance > RETURN_DISTANCE)) shown.onReturnElsewhere?.();
};

/** Each person drawn, as the recorder keeps them: their readout and tracked key points. */
const recordedPlayers = (people: VisionFrame["people"], readouts: PersonReadout[]): RecordedPlayer[] =>
  readouts.flatMap((readout) => {
    const person = people.find(({ id }) => id === readout.id);
    return person ? [{ ...readout, keyPoints: person.keyPoints }] : [];
  });

/** When a frame reached each step of the loop, in `performance.now()` milliseconds. */
interface FrameTimes {
  /** When it was given to the model. */
  timestamp: number;
  /** When the model returned it. */
  inferenceEnd: number;
  /** When it had been tracked. */
  trackEnd: number;
  /** When the monitors had been given it. */
  monitorEnd: number;
}

/** Who a frame tracked: the people drawn, where they stand, and who watches. */
interface FramePeople {
  /** The people drawn. */
  people: VisionFrame["people"];
  /** Each person's floor position, by id. */
  where: Map<number, PlayerPosition>;
  /** The spectator watch's report. */
  watching: SpectatorReport;
}

/**
 * Reports each drawn frame: its speed and its people to the debug readouts, at most every {@link STATS_INTERVAL_MS},
 * and the whole frame to the recorder while it records.
 * @returns a function to call once per frame, after it has been drawn
 */
const frameReporter = (
  { onStats, onPeople, recorder }: Pick<LoopHandlers, "onStats" | "onPeople" | "recorder">,
  registry: PlayerRegistry,
) => {
  const reportStats = statsReporter(onStats);
  const reportPeople = peopleReporter(onPeople);
  return (detected: VisionFrame, times: FrameTimes, { people, where, watching }: FramePeople) => {
    const { timestamp, inferenceEnd, trackEnd, monitorEnd } = times;
    const describe = () => describePeople(people, where, watching, (id) => registry.numberOf(id));
    reportPeople(describe);
    const players = recorder?.state === "recording" ? recordedPlayers(people, describe()) : undefined;
    if (players) recorder?.addFrame({ timestamp, inferenceMs: inferenceEnd - timestamp, detected, players });
    reportStats(detected, timestamp, inferenceEnd, {
      trackMs: trackEnd - inferenceEnd,
      monitorMs: monitorEnd - trackEnd,
      drawMs: performance.now() - monitorEnd,
    });
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
 * Hands each frame to `report` as the model returns it, while giving the model the next one.
 * @returns a function that stops it
 */
const runDetections = (
  detections: ReturnType<typeof videoDetections>,
  report: (timestamp: number, detected: VisionFrame, inferenceEnd: number) => void,
): (() => void) => {
  let cancelled = false;
  // A failed frame is skipped rather than ending the loop; only the first failure is logged, as it may repeat every frame
  let warned = false;
  const run = async (detection: Promise<Detection>) => {
    let next: Promise<Detection> | undefined;
    try {
      const { timestamp, result } = await detection;
      const { detected, inferenceEnd } = await result;
      if (cancelled) return; // the model may have been disposed while this frame was tracked
      next = detections.next();
      report(timestamp, detected, inferenceEnd);
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
    detections.cancel();
  };
};

/**
 * Tracks the people in each video frame: reports players and feet, then draws each one's silhouette on their own canvas.
 *
 * The loop is pipelined: as soon as the model returns a frame, it is given the next one, and the frame it returned is
 * reported and drawn while it works. Only one frame is with the model at a time.
 * @returns a function that stops the loop
 */
const startTrackingLoop = (
  model: FootstepsVisionModelImplementation,
  video: HTMLVideoElement,
  {
    reference,
    canvases,
    players: registry,
  }: { reference: HTMLCanvasElement; canvases: PlayerCanvases; players: PlayerRegistry },
  {
    offScreenThreshold_percent,
    onPlayersChange,
    maskType,
    settings: { smoothing, hold, fillGaps, inputWidth, featherPx, position, spectators, virtual },
    onStats,
    onPeople,
    floor,
    shownSpectators,
    recorder,
  }: LoopHandlers,
): (() => void) => {
  const detections = videoDetections(model, video, inputWidth);
  sizeToVideo(video, reference, canvases, registry);
  const positions = new PlayerPositions(position);
  const watch = new SpectatorWatch(spectators);
  const report = frameReporter({ onStats, onPeople, recorder }, registry);
  const tracker = smoothing ? new PersonTracker(hold, fillGaps) : null;

  const reportAndDraw = (timestamp: number, detected: VisionFrame, inferenceEnd: number) => {
    const frames = registry.update(tracker ? tracker.update(detected, registry.spectatorTrackIds()) : detected);
    const { toPosition, sorted } = floor.current;
    const where = positions.update(frames.drawn, toPosition);
    // Only a floor has an outside to watch from
    const watching = sorted ? watch.update(where, detected.timestamp, registry.knownIds()) : NO_SPECTATORS;
    registry.setSpectators(watching.spectators);
    noteReturns(watching, shownSpectators.current);
    const placed = placePlayers(frames.interactive, where, floor.current, virtual);
    const playing = placed.frame.people.filter(({ id }) => !watching.spectators.has(id));
    const players = playersOf({ ...placed.frame, people: playing }, placed.positions, offScreenThreshold_percent);
    const trackEnd = performance.now();
    onPlayersChange?.(players, timestamp);
    const monitorEnd = performance.now();
    const drawnSpectators = { report: watching, settings: shownSpectators.current.settings, margin: spectators.margin };
    drawPlayers(
      video,
      frames,
      { canvases, ...placed, sorted, floor: floor.current, players: registry, spectators: drawnSpectators },
      { maskType, featherPx },
    );
    report(
      detected,
      { timestamp, inferenceEnd, trackEnd, monitorEnd },
      { people: frames.drawn.people, where, watching },
    );
  };

  const stopDetecting = runDetections(detections, reportAndDraw);
  return () => {
    stopDetecting();
    registry.resetTracking(reference.width);
    canvases.removeAllBut(registry.knownIds());
  };
};

/** Each person found, as "P1 player (42, 87) off 0" or "spectator (50, 112) off 12 → player in 180 ms". */
const PeopleReadout = ({ people }: { people: PersonReadout[] }) => (
  <output
    className="vision-people"
    style={{ position: "absolute", top: "1.6em", left: 0, padding: "2px 6px", background: "#000a", color: "#fff" }}
  >
    {people.map(({ id, number, role, position, offBy, pendingMs }) => (
      <div key={id} data-person-id={id} data-role={role} data-off-by={offBy.toFixed(1)}>
        {number === undefined ? `#${id}` : `P${number}`} {role}
        {position && ` (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`} off {offBy.toFixed(1)}
        {pendingMs !== undefined && ` → ${role === "spectator" ? "player" : "spectator"} in ${pendingMs.toFixed(0)} ms`}
      </div>
    ))}
  </output>
);

/** The readouts shown over the canvas, and the loop's callbacks that fill them: none for a readout that's off. */
const useReadouts = (showStats: boolean, showPeople: boolean) => {
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [people, setPeople] = useState<PersonReadout[]>([]);
  return {
    stats: showStats ? stats : null,
    people: showPeople ? people : null,
    onStats: showStats ? setStats : undefined,
    onPeople: showPeople ? setPeople : undefined,
  };
};

/** The loop's frame rate, the time each step takes, and what the frame found; benchmarks read the data attributes. */
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

/** What the tracking loop needs from the component: the camera, the players, and its handlers. */
type TrackingLoopProps = LoopHandlers & {
  /** The webcam video. */
  video: HTMLVideoElement | null;
  /** The webcam stream. */
  mediaStream: MediaStream | undefined;
  /** The players the loop follows. */
  players: PlayerRegistry;
};

/** Runs {@link startTrackingLoop} while there is a model, a video, a stream and a canvas, restarting as they change. */
const useTrackingLoop = (
  model: FootstepsVisionModelImplementation | null,
  canvas: RefObject<HTMLCanvasElement | null>,
  { video, mediaStream, players, ...handlers }: TrackingLoopProps,
) => {
  const canvasesRef = useRef<PlayerCanvases | null>(null);
  const { offScreenThreshold_percent, onPlayersChange, maskType, settings, onStats, onPeople } = handlers;
  const { floor, shownSpectators, recorder } = handlers;
  // The stream belongs to CharacterCamera, which stops its tracks; this effect only stops its own loop
  useEffect(() => {
    const canvasElement = canvas.current;
    if (!model || !video || !mediaStream || !canvasElement) return;
    const loopHandlers = {
      offScreenThreshold_percent,
      onPlayersChange,
      maskType,
      settings,
      onStats,
      onPeople,
      floor,
      shownSpectators,
      recorder,
    };
    const canvases = (canvasesRef.current ??= new PlayerCanvases(canvasElement));
    return startTrackingLoop(model, video, { reference: canvasElement, canvases, players }, loopHandlers);
  }, [
    model,
    mediaStream,
    video,
    canvas,
    players,
    onPlayersChange,
    offScreenThreshold_percent,
    maskType,
    settings,
    onStats,
    onPeople,
    floor,
    shownSpectators,
    recorder,
  ]);
};

/**
 * Runs the configured vision model on the webcam video every frame, draws each player's silhouette on their own canvas,
 * and reports where each person is. The canvas rendered here is the reference theirs are made like; see {@link PlayerCanvases}.
 */
export default function CharacterCanvas({
  canvasRef,
  className,
  style,
  maskType = "binary",
  showStats = false,
  showPeople = false,
  floor,
  mirrored = false,
  ...loopProps
}: CharacterCanvasProps) {
  const config = useAppConfig();
  const model = useVisionModel(loopProps.mediaStream, useModelConfig(config));
  const settings = useLoopSettings(config);
  const { stats, people, onStats, onPeople } = useReadouts(showStats, showPeople);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvas = canvasRef ?? internalCanvasRef;
  const players = useContext(PlayerRegistryContext);
  const { video, mediaStream, offScreenThreshold_percent, onPlayersChange } = loopProps;
  const floorRef = usePlayersFloor(floor, mirrored);
  const spectatorsRef = useLatest(useContext(SpectatorsContext));
  const recorder = useContext(RecorderContext);
  useRecordingSource(recorder, mediaStream, { floor, mirrored, config });

  useTrackingLoop(model, canvas, {
    video,
    mediaStream,
    players,
    offScreenThreshold_percent,
    onPlayersChange,
    maskType,
    settings,
    onStats,
    onPeople,
    floor: floorRef,
    shownSpectators: spectatorsRef,
    recorder,
  });

  return (
    <>
      <canvas ref={canvas} className={className} style={style} />
      {stats && <FrameStatsReadout stats={stats} />}
      {people && <PeopleReadout people={people} />}
    </>
  );
}
