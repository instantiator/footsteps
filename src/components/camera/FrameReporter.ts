import type { Recorder } from "../../debug/Recorder";
import type { RecordedPlayer } from "../../debug/RecordingFormat";
import type { VisionFrame } from "../../vision/VisionTypes";
import { frameQuality, FrameStatsRecorder, type FrameStats, type FrameSteps } from "./FrameStats";
import type { PlayerPosition } from "./PlayerPosition";
import type { PlayerRegistry } from "./PlayerRegistry";
import { describePeople, type PersonReadout, type SpectatorReport } from "./Spectators";

/** How often the stats readout updates, in milliseconds; every frame would re-render too often. */
export const STATS_INTERVAL_MS = 500;

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

/** Where the tracking loop's reports go: the debug readouts, and the recorder. */
export interface FrameReporterHandlers {
  /** Called at most every {@link STATS_INTERVAL_MS} with the loop's speed; omitted when nobody is looking. */
  onStats?: (stats: FrameStats) => void;
  /** Called at most every {@link STATS_INTERVAL_MS} with each person found; omitted when nobody is looking. */
  onPeople?: (people: PersonReadout[]) => void;
  /** The debug recorder, given each frame while it records. */
  recorder: Recorder | null;
}

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

/** Each person drawn, as the recorder keeps them: their readout and tracked key points. */
const recordedPlayers = (people: VisionFrame["people"], readouts: PersonReadout[]): RecordedPlayer[] =>
  readouts.flatMap((readout) => {
    const person = people.find(({ id }) => id === readout.id);
    return person ? [{ ...readout, keyPoints: person.keyPoints }] : [];
  });

/** When a frame reached each step of the loop, in `performance.now()` milliseconds. */
export interface FrameTimes {
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
export interface FramePeople {
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
export const frameReporter = ({ onStats, onPeople, recorder }: FrameReporterHandlers, registry: PlayerRegistry) => {
  const reportStats = statsReporter(onStats);
  const reportPeople = peopleReporter(onPeople);
  return (detected: VisionFrame, times: FrameTimes, { people, where, watching }: FramePeople) => {
    const { timestamp, inferenceEnd, trackEnd, monitorEnd } = times;
    const describe = () => describePeople(people, where, watching, (id) => registry.numberOf(id));
    reportPeople(describe);
    const players = recorder?.state === "recording" ? recordedPlayers(people, describe()) : undefined;
    if (players) {
      const states = Object.fromEntries(
        [...registry.knownIds()].flatMap((id) => {
          const state = registry.stateOf(id);
          return state ? [[id, state]] : [];
        }),
      );
      recorder?.addFrame({ timestamp, inferenceMs: inferenceEnd - timestamp, detected, players, states });
    }
    reportStats(detected, timestamp, inferenceEnd, {
      trackMs: trackEnd - inferenceEnd,
      monitorMs: monitorEnd - trackEnd,
      drawMs: performance.now() - monitorEnd,
    });
  };
};
