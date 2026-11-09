import { useCallback, useEffect, useMemo, useRef } from "react";
import useAppConfig from "../../providers/AppConfigHook";
import type { Point } from "../../vision/VisionTypes";

/** Each player's position as rules and templates see it, by player number. */
export type PublishedPositions = Record<number, Point>;

/** How positions are coarsened for rules and templates. */
export interface PublisherSettings {
  /** The size of a grid cell, in position units. */
  cell: number;
  /** The most times a second positions are published. */
  ratePerSecond: number;
}

/** How far past a cell's edge a position must go to move to the next cell, as a fraction of the cell. */
const HYSTERESIS = 0.25;

/** The cell a coordinate is in, staying in the current one until it is a quarter of a cell past its edge. */
const cellOf = (value: number, cell: number, current: number | undefined): number => {
  const candidate = Math.floor(value / cell);
  if (current === undefined || candidate === current) return candidate;
  const margin = cell * HYSTERESIS;
  const outside = value < current * cell - margin || value >= (current + 1) * cell + margin;
  return outside ? candidate : current;
};

/**
 * Turns players' positions, which change every frame, into ones that change rarely enough for rules and templates:
 * each is quantised to the centre of a grid cell, only moves cell once it is well past the edge, and the whole set is
 * published together, at most `ratePerSecond` times a second.
 */
export class PositionPublisher {
  private readonly settings: PublisherSettings;
  private readonly cells = new Map<number, Point>();
  private pending = false;
  private publishedAt = -Infinity;

  constructor(settings: PublisherSettings) {
    this.settings = settings;
  }

  /**
   * Takes every player's latest position.
   * @param positions by player number; a player missing has gone
   * @param now the time, in milliseconds
   * @returns the positions to publish, or undefined if nothing has changed or it is too soon
   */
  update(positions: Map<number, Point>, now: number): PublishedPositions | undefined {
    const { cell } = this.settings;
    for (const number of this.cells.keys()) {
      if (positions.has(number)) continue;
      this.cells.delete(number);
      this.pending = true;
    }
    for (const [number, { x, y }] of positions) {
      const before = this.cells.get(number);
      const after = { x: cellOf(x, cell, before?.x), y: cellOf(y, cell, before?.y) };
      if (before?.x === after.x && before.y === after.y) continue;
      this.cells.set(number, after);
      this.pending = true;
    }
    return this.flush(now);
  }

  /** The positions waiting to be published, if it is now time to. */
  flush(now: number): PublishedPositions | undefined {
    if (!this.pending || now < this.dueAt()) return undefined;
    this.pending = false;
    this.publishedAt = now;
    const { cell } = this.settings;
    return Object.fromEntries(
      Array.from(this.cells, ([number, { x, y }]) => [number, { x: (x + 0.5) * cell, y: (y + 0.5) * cell }]),
    );
  }

  /** When the positions waiting can be published, or undefined if none are waiting. */
  pendingDueAt(): number | undefined {
    return this.pending ? this.dueAt() : undefined;
  }

  private dueAt(): number {
    return this.publishedAt + 1000 / this.settings.ratePerSecond;
  }
}

/**
 * Publishes players' positions to rules and templates, quantised and rate-limited by the app's settings. A change held
 * back by the rate limit is published once it may be, even if no more positions arrive.
 * @param publish where the positions go; keep it stable
 * @returns where to report every player's latest position, by number
 */
export function usePositionVariables(
  publish: ((positions: PublishedPositions) => void) | undefined,
): (positions: Map<number, Point>) => void {
  const { positionCellSize: cell, positionUpdatesPerSecond: ratePerSecond } = useAppConfig();
  const publisher = useMemo(() => new PositionPublisher({ cell, ratePerSecond }), [cell, ratePerSecond]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), [publisher]);

  return useCallback(
    (positions: Map<number, Point>) => {
      const now = performance.now();
      const published = publisher.update(positions, now);
      if (published) publish?.(published);
      clearTimeout(timer.current);
      const due = publisher.pendingDueAt();
      if (due === undefined) return;
      timer.current = setTimeout(() => {
        const late = publisher.flush(performance.now());
        if (late) publish?.(late);
      }, due - now);
    },
    [publisher, publish],
  );
}
