import { describe, expect, it } from "vitest";
import { DEFAULT_CORNERS } from "../src/components/camera/FloorGeometry";
import {
  depthZIndex,
  groundPointOf,
  PlayerPositions,
  PositionFollower,
  positionMapping,
  UNSORTED_PLAYER_Z_INDEX,
} from "../src/components/camera/PlayerPosition";
import { noKeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const WIDTH = 100;
const HEIGHT = 100;

/** A silhouette filling the rows from `top` up to but not including `bottom`, across the given columns. */
const silhouette = (top: number, bottom: number, left = 40, right = 60): Uint8Array => {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = top; y < bottom; y++) mask.fill(1, y * WIDTH + left, y * WIDTH + right);
  return mask;
};

describe("groundPointOf", () => {
  it("is the bottom of the silhouette, and the middle of its lowest pixels, as percentages of the frame", () => {
    expect(groundPointOf(silhouette(20, 75), WIDTH)).toEqual({ x: 50, y: 75 });
  });

  it("goes across to where the feet are, not where the body is", () => {
    const mask = silhouette(20, 70, 40, 60);
    for (let y = 70; y < 75; y++) mask.fill(1, y * WIDTH + 10, y * WIDTH + 30);
    expect(groundPointOf(mask, WIDTH)).toEqual({ x: 20, y: 75 });
  });

  it("ignores a few stray pixels below the silhouette", () => {
    const mask = silhouette(20, 75);
    mask[99 * WIDTH + 3] = 1;
    expect(groundPointOf(mask, WIDTH)).toEqual({ x: 50, y: 75 });
  });

  it("is nothing for an empty silhouette", () => {
    expect(groundPointOf(new Uint8Array(WIDTH * HEIGHT), WIDTH)).toBeNull();
  });
});

describe("PositionFollower", () => {
  const settings = { windowMs: 700, deadband: 2 };
  const at = (x: number, y: number) => ({ x, y });

  it("starts at the first ground point", () => {
    expect(new PositionFollower(settings).update(at(30, 60), 0)).toEqual(at(30, 60));
  });

  it("holds where they took off from through a jump, across as well as down", () => {
    const follower = new PositionFollower(settings);
    follower.update(at(30, 80), 0);
    for (const [x, y, time] of [
      [32, 70, 100],
      [40, 65, 200],
      [45, 70, 300],
    ]) {
      expect(follower.update(at(x, y), time)).toEqual(at(30, 80));
    }
    expect(follower.update(at(45, 80), 400)).toEqual(at(45, 80));
  });

  it("follows walking across at once", () => {
    const follower = new PositionFollower(settings);
    follower.update(at(30, 60), 0);
    expect(follower.update(at(40, 60), 100)).toEqual(at(40, 60));
  });

  it("shows stepping nearer at once", () => {
    const follower = new PositionFollower(settings);
    follower.update(at(30, 60), 0);
    expect(follower.update(at(30, 75), 100).y).toBe(75);
  });

  it("shows stepping away only once the window has passed", () => {
    const follower = new PositionFollower(settings);
    follower.update(at(30, 75), 0);
    expect(follower.update(at(30, 60), 600).y).toBe(75);
    expect(follower.update(at(30, 60), 800).y).toBe(60);
  });

  it("doesn't flicker when the ground point jitters within the deadband", () => {
    const follower = new PositionFollower({ windowMs: 0, deadband: 2 });
    follower.update(at(30, 60), 0);
    for (const [x, y, time] of [
      [31, 61, 100],
      [29, 59, 200],
      [32, 62, 300],
      [28, 58, 400],
    ]) {
      expect(follower.update(at(x, y), time)).toEqual(at(30, 60));
    }
    expect(follower.update(at(33, 63), 500)).toEqual(at(33, 63));
  });
});

describe("positionMapping", () => {
  it("gives screen floor coordinates on a floor", () => {
    const position = positionMapping(DEFAULT_CORNERS, false)(DEFAULT_CORNERS.frontLeft);
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(100);
  });

  it("runs floor x from the screen's left when mirrored", () => {
    expect(positionMapping(DEFAULT_CORNERS, true)(DEFAULT_CORNERS.frontLeft).x).toBeCloseTo(100);
  });

  it("gives percentages of the scene without a floor, flipped when mirrored", () => {
    expect(positionMapping(undefined, false)({ x: 0.2, y: 0.9 })).toEqual({ x: 20, y: 90 });
    expect(positionMapping(undefined, true)({ x: 0.2, y: 0.9 }).x).toBeCloseTo(80);
  });
});

describe("PlayerPositions", () => {
  const settings = { windowMs: 0, deadband: 0 };
  const scene = positionMapping(undefined, false);
  const person = (id: number, bottom: number, held?: VisionPerson["held"]): VisionPerson => ({
    id,
    mask: silhouette(10, bottom),
    keyPoints: noKeyPoints(),
    scale: 1,
    ...(held && { held }),
  });
  const frame = (timestamp: number, ...people: VisionPerson[]): VisionFrame => ({
    width: WIDTH,
    height: HEIGHT,
    timestamp,
    people,
  });

  it("maps each player's ground point to a position", () => {
    const positions = new PlayerPositions(settings).update(frame(0, person(0, 50)), scene);
    expect(positions.get(0)).toEqual({ ground: { x: 50, y: 50 }, position: { x: 50, y: 50 } });
  });

  it("keeps a held player where they were last seen", () => {
    const positions = new PlayerPositions(settings);
    positions.update(frame(0, person(0, 50)), scene);

    expect(positions.update(frame(100, person(0, 90, { opacity: 1 })), scene).get(0)?.position.y).toBe(50);
  });

  it("follows each player separately, and forgets one who has gone", () => {
    const positions = new PlayerPositions({ windowMs: 700, deadband: 0 });

    const both = positions.update(frame(0, person(0, 50), person(1, 70)), scene);
    expect([both.get(0)?.position.y, both.get(1)?.position.y]).toEqual([50, 70]);

    positions.update(frame(100, person(0, 50)), scene);
    expect(positions.update(frame(200, person(0, 50), person(1, 40)), scene).get(1)?.position.y).toBe(40);
  });

  it("has no position for a player whose ground hasn't been seen", () => {
    const empty: VisionPerson = { ...person(0, 50), mask: new Uint8Array(WIDTH * HEIGHT) };
    expect(new PlayerPositions(settings).update(frame(0, empty), scene).size).toBe(0);
  });
});

describe("depthZIndex", () => {
  it("sorts everything behind whatever in the foreground has no depth, and nearer in front", () => {
    expect(depthZIndex(100)).toBeLessThan(0);
    expect(depthZIndex(80)).toBeGreaterThan(depthZIndex(30));
    expect(UNSORTED_PLAYER_Z_INDEX).toBeLessThanOrEqual(depthZIndex(0));
  });

  it("keeps depths off the floor to its ends", () => {
    expect(depthZIndex(-20)).toBe(depthZIndex(0));
    expect(depthZIndex(130)).toBe(depthZIndex(100));
  });
});
