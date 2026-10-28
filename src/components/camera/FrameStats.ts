import type { VisionFrame } from "../../vision/VisionTypes";

/** How fast the vision loop is running, and what it found in the latest frame, for the debug readout and benchmarks. */
export interface FrameStats extends FrameTiming, FrameQuality {}

/** How fast the vision loop is running. */
export interface FrameTiming {
  /** Frames completed per second. */
  fps: number;
  /** Median time the model took per frame, in milliseconds. */
  inferenceMs: number;
  /** Median time spent following people between frames, in milliseconds. */
  trackMs: number;
  /** Median time the interaction monitors took, in milliseconds. */
  monitorMs: number;
  /** Median time drawing the silhouettes took, in milliseconds. */
  drawMs: number;
}

/** How long each step after the model took for one frame, in milliseconds. */
export type FrameSteps = Pick<FrameTiming, "trackMs" | "monitorMs" | "drawMs">;

/** Step timings for a frame that only measured the model. */
const NO_STEPS: FrameSteps = { trackMs: 0, monitorMs: 0, drawMs: 0 };

/** What a frame found: enough to compare models without a hand-labelled answer. */
export interface FrameQuality {
  /** How many people were found. */
  people: number;
  /** How many hands were placed, of up to two per person. */
  hands: number;
  /** How many feet were placed, of up to two per person. */
  feet: number;
  /** The percentage of the frame inside anyone's silhouette. */
  coverage: number;
  /** How far down the frame the silhouettes reach, as a percentage of its height, averaged over people. */
  reach: number;
}

/** How many recent frames the timings cover. */
const WINDOW = 30;

/** The median of a non-empty list. */
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Collects per-frame timings over a rolling window. */
export class FrameStatsRecorder {
  private readonly ends: number[] = [];
  private readonly inference: number[] = [];
  private readonly steps: FrameSteps[] = [];

  /**
   * Records one completed frame.
   * @param start when the model was given the frame, in milliseconds
   * @param inferenceEnd when the model returned
   * @param steps how long each step after the model took
   */
  record(start: number, inferenceEnd: number, steps: FrameSteps = NO_STEPS): void {
    this.ends.push(inferenceEnd);
    this.inference.push(inferenceEnd - start);
    this.steps.push(steps);
    if (this.ends.length > WINDOW) {
      this.ends.shift();
      this.inference.shift();
      this.steps.shift();
    }
  }

  /** The timings over the window, or null until there are two frames to measure between. */
  timing(): FrameTiming | null {
    if (this.ends.length < 2) return null;
    const seconds = (this.ends[this.ends.length - 1] - this.ends[0]) / 1000;
    return {
      fps: seconds > 0 ? (this.ends.length - 1) / seconds : 0,
      inferenceMs: median(this.inference),
      trackMs: median(this.steps.map((step) => step.trackMs)),
      monitorMs: median(this.steps.map((step) => step.monitorMs)),
      drawMs: median(this.steps.map((step) => step.drawMs)),
    };
  }
}

/** The lowest row of a mask that has any of the person in it, or -1 for an empty mask. */
const lowestRow = (mask: Uint8Array, width: number): number => {
  for (let i = mask.length - 1; i >= 0; i--) if (mask[i] === 1) return Math.floor(i / width);
  return -1;
};

/** What a frame found. Scans every mask, so it runs only when the readout updates, not every frame. */
export const frameQuality = ({ width, height, people }: VisionFrame): FrameQuality => {
  const placed = (names: ("leftHand" | "rightHand" | "leftFoot" | "rightFoot")[]) =>
    people.reduce((total, { keyPoints }) => total + names.filter((name) => keyPoints[name] !== null).length, 0);
  const pixels = width * height;
  let covered = 0;
  for (let i = 0; i < pixels; i++) if (people.some(({ mask }) => mask[i] === 1)) covered++;
  const reaches = people.map(({ mask }) => lowestRow(mask, width)).filter((row) => row >= 0);
  return {
    people: people.length,
    hands: placed(["leftHand", "rightHand"]),
    feet: placed(["leftFoot", "rightFoot"]),
    coverage: pixels > 0 ? (100 * covered) / pixels : 0,
    reach:
      reaches.length > 0 && height > 0 ? (100 * reaches.reduce((a, b) => a + b + 1, 0)) / reaches.length / height : 0,
  };
};
