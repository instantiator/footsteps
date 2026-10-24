/** How fast the vision loop is running, for the debug readout and benchmarks. */
export interface FrameStats {
  /** Frames completed per second. */
  fps: number;
  /** Median time the model took per frame, in milliseconds. */
  inferenceMs: number;
}

/** How many recent frames the stats cover. */
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

  /**
   * Records one completed frame.
   * @param start when the model was given the frame, in milliseconds
   * @param inferenceEnd when the model returned
   */
  record(start: number, inferenceEnd: number): void {
    this.ends.push(inferenceEnd);
    this.inference.push(inferenceEnd - start);
    if (this.ends.length > WINDOW) {
      this.ends.shift();
      this.inference.shift();
    }
  }

  /** The stats over the window, or null until there are two frames to measure between. */
  stats(): FrameStats | null {
    if (this.ends.length < 2) return null;
    const seconds = (this.ends[this.ends.length - 1] - this.ends[0]) / 1000;
    return { fps: seconds > 0 ? (this.ends.length - 1) / seconds : 0, inferenceMs: median(this.inference) };
  }
}
