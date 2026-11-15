import { describe, expect, it } from "vitest";
import { distanceOffFloor, RETURN_DISTANCE, SpectatorWatch } from "../src/components/camera/Spectators";
import type { PlayerPosition } from "../src/components/camera/PlayerPosition";
import type { Point } from "../src/vision/VisionTypes";

const HOLD = 1000;

/** A watch, and a step that puts player 1 at a floor position at a time. */
const watching = () => {
  const watch = new SpectatorWatch({ margin: 5, holdMs: HOLD });
  const known = new Set([1]);
  const at = (position: Point, now: number) =>
    watch.update(new Map<number, PlayerPosition>([[1, { ground: position, position }]]), now, known);
  return { watch, known, at };
};

const ON = { x: 50, y: 50 };
const OFF = { x: 50, y: 120 };

describe("distanceOffFloor", () => {
  it.each([
    [ON, 0],
    [{ x: -3, y: 50 }, 3],
    [{ x: 103, y: 104 }, 5],
  ])("%o is %d off the floor", (point, distance) => expect(distanceOffFloor(point)).toBe(distance));
});

describe("SpectatorWatch", () => {
  it("makes someone off the floor past the margin for the hold a spectator", () => {
    const { at } = watching();
    at(ON, 0);
    expect(at(OFF, 100).spectators.has(1)).toBe(false);
    expect(at(OFF, 100 + HOLD).spectators.has(1)).toBe(true);
    expect(at(OFF, 200 + HOLD).distances.get(1)).toBe(20);
  });

  it("keeps a player who steps over the edge for less than the hold, or stands within the margin", () => {
    const { at } = watching();
    at(ON, 0);
    at(OFF, 100);
    at(ON, 500);
    expect(at(OFF, 100 + HOLD).spectators.has(1)).toBe(false);
    expect(at({ x: 50, y: 104 }, 5000).spectators.has(1)).toBe(false);
  });

  it("keeps a player jumping at the front edge, whose held position stays put", () => {
    const { at } = watching();
    const edge = { x: 50, y: 99 };
    for (let now = 0; now <= 3 * HOLD; now += 100) expect(at(edge, now).spectators.has(1)).toBe(false);
  });

  it("makes a spectator who walks back on a player after the hold, reporting how far from where they left", () => {
    const { at } = watching();
    at({ x: 10, y: 90 }, 0);
    at(OFF, 100);
    at(OFF, 100 + HOLD);
    const back = { x: 70, y: 90 };
    expect(at(back, 2000).returned).toEqual([]);
    const report = at(back, 2000 + HOLD);
    expect(report.spectators.has(1)).toBe(false);
    expect(report.returned).toEqual([{ id: 1, distance: 60 }]);
  });

  it(`reports a return near where they left as within ${RETURN_DISTANCE}, and one across the floor as beyond it`, () => {
    const leaveAndReturn = (back: Point) => {
      const { at } = watching();
      at({ x: 50, y: 95 }, 0);
      at(OFF, 100);
      at(OFF, 100 + HOLD);
      at(back, 3000);
      return at(back, 3000 + HOLD).returned[0].distance;
    };
    expect(leaveAndReturn({ x: 55, y: 90 })).toBeLessThan(RETURN_DISTANCE);
    expect(leaveAndReturn({ x: 5, y: 10 })).toBeGreaterThan(RETURN_DISTANCE);
  });

  it("makes someone first seen off the floor a spectator at once, and their walking on no return", () => {
    const { at } = watching();
    expect(at(OFF, 0).spectators.has(1)).toBe(true);
    at(ON, 100);
    expect(at(ON, 100 + HOLD).returned).toEqual([]);
  });

  it("keeps a lost spectator while the game knows them, and forgets them after", () => {
    const { watch, known, at } = watching();
    at(OFF, 0);
    expect(watch.update(new Map(), 100, known).spectators.has(1)).toBe(true);
    known.clear();
    expect(watch.update(new Map(), 200, known).spectators.size).toBe(0);
  });
});
