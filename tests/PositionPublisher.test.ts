import { describe, expect, it } from "vitest";
import { PositionPublisher } from "../src/components/camera/PositionPublisher";
import type { Point } from "../src/vision/VisionTypes";

/** A publisher with 5-unit cells, publishing at most 10 times a second. */
const publisher = () => new PositionPublisher({ cell: 5, ratePerSecond: 10 });

/** Positions for players 1, 2, … in order. */
const players = (...points: Point[]) => new Map(points.map((point, i) => [i + 1, point]));

describe("PositionPublisher", () => {
  it("publishes each player at the centre of their cell", () => {
    expect(publisher().update(players({ x: 41, y: 79.9 }), 0)).toEqual({ 1: { x: 42.5, y: 77.5 } });
  });

  it("publishes nothing while a player stays in their cell", () => {
    const positions = publisher();
    positions.update(players({ x: 41, y: 76 }), 0);
    expect(positions.update(players({ x: 44, y: 79 }), 1000)).toBeUndefined();
  });

  it("only moves cell once a player is a quarter of a cell past its edge", () => {
    const positions = publisher();
    positions.update(players({ x: 42, y: 50 }), 0);
    expect(positions.update(players({ x: 46, y: 50 }), 1000)).toBeUndefined();
    expect(positions.update(players({ x: 46.25, y: 50 }), 2000)).toEqual({ 1: { x: 47.5, y: 52.5 } });
    expect(positions.update(players({ x: 44, y: 50 }), 3000)).toBeUndefined();
  });

  it("doesn't flicker for a player standing on a cell's edge", () => {
    const positions = publisher();
    positions.update(players({ x: 49.5, y: 50 }), 0);
    for (const [x, time] of [
      [50.5, 1000],
      [49.2, 2000],
      [51, 3000],
    ]) {
      expect(positions.update(players({ x, y: 50 }), time)).toBeUndefined();
    }
  });

  it("holds a change back until the rate allows, then publishes the latest", () => {
    const positions = publisher();
    positions.update(players({ x: 10, y: 10 }), 0);
    expect(positions.update(players({ x: 30, y: 10 }), 50)).toBeUndefined();
    expect(positions.update(players({ x: 60, y: 10 }), 60)).toBeUndefined();
    expect(positions.pendingDueAt()).toBe(100);
    expect(positions.flush(99)).toBeUndefined();
    expect(positions.flush(100)).toEqual({ 1: { x: 62.5, y: 12.5 } });
    expect(positions.pendingDueAt()).toBeUndefined();
  });

  it("publishes every player together, and drops one who has gone", () => {
    const positions = publisher();
    expect(positions.update(players({ x: 10, y: 10 }, { x: 90, y: 90 }), 0)).toEqual({
      1: { x: 12.5, y: 12.5 },
      2: { x: 92.5, y: 92.5 },
    });
    expect(positions.update(players({ x: 10, y: 10 }), 1000)).toEqual({ 1: { x: 12.5, y: 12.5 } });
    expect(positions.update(new Map(), 2000)).toEqual({});
  });

  it("publishes positions off the floor too", () => {
    expect(publisher().update(players({ x: -3, y: 104 }), 0)).toEqual({ 1: { x: -2.5, y: 102.5 } });
  });
});
