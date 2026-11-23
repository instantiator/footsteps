import { describe, expect, it } from "vitest";
import { DEFAULT_CORNERS } from "../src/components/camera/FloorGeometry";
import type { PlayerPosition } from "../src/components/camera/PlayerPosition";
import {
  placementsOf,
  placementStyle,
  placePerson,
  placePlayers,
  type Placement,
} from "../src/components/camera/VirtualPlayers";
import { noKeyPoints, type VisionFrame } from "../src/vision/VisionTypes";

/** A 10×10 frame with one person: a 2×4 block standing on the bottom row, feet at (5, 9). */
const frame = (): VisionFrame => {
  const mask = new Uint8Array(100);
  for (let y = 6; y < 10; y++) for (let x = 4; x < 6; x++) mask[y * 10 + x] = 1;
  return {
    width: 10,
    height: 10,
    timestamp: 0,
    people: [
      { id: 1, mask, keyPoints: { ...noKeyPoints(), leftFoot: { x: 5, y: 9 }, headTop: { x: 5, y: 6 } }, scale: 2 },
    ],
  };
};

/** A player standing on the ground at (50%, 90%) of the frame, at the given position. */
const standing = (position: { x: number; y: number }): Map<number, PlayerPosition> =>
  new Map([[1, { ground: { x: 50, y: 90 }, position }]]);

const SCENE_2D = { mirrored: false };

describe("virtual players", () => {
  it("leaves everyone as they are at life size and real movement", () => {
    const placed = placePlayers(frame(), standing({ x: 70, y: 50 }), SCENE_2D, { playerScale: 1, motionGain: 1 });
    expect(placed.placements.size).toBe(0);
    expect(placed.frame).toEqual(frame());
  });

  it("shrinks a player about their ground point: key points, mask and size", () => {
    const placement: Placement = { from: { x: 0.5, y: 0.9 }, to: { x: 0.5, y: 0.9 }, scale: 0.5 };
    const person = placePerson(frame().people[0], placement, 10, 10);
    expect(person.keyPoints.headTop).toEqual({ x: 5, y: 7.5 });
    expect(person.keyPoints.leftFoot).toEqual({ x: 5, y: 9 });
    expect(person.scale).toBe(1);
    const rows = Array.from({ length: 10 }, (_, y) => person.mask.slice(y * 10, y * 10 + 10).some((v) => v === 1));
    expect(rows.indexOf(true)).toBeGreaterThanOrEqual(7); // half as tall, still standing on the same spot
  });

  it("moves a player further from the centre by the gain, in a 2D scene", () => {
    const [placement] = placementsOf(standing({ x: 70, y: 50 }), SCENE_2D, { playerScale: 1, motionGain: 2 }).values();
    expect(placement.to.x).toBeCloseTo(0.9, 6); // 20 from the centre becomes 40
    expect(placement.scale).toBe(1);
  });

  it("draws a player moved further back smaller, as the floor is narrower there", () => {
    const floor = { corners: DEFAULT_CORNERS, mirrored: false };
    const [placement] = placementsOf(standing({ x: 50, y: 40 }), floor, { playerScale: 1, motionGain: 2 }).values();
    expect(placement.scale).toBeLessThan(1);
    const placed = placePlayers(frame(), standing({ x: 50, y: 40 }), floor, { playerScale: 1, motionGain: 2 });
    expect(placed.positions.get(1)?.position).toEqual({ x: 50, y: 30 });
    expect(placed.positions.get(1)?.ground).toEqual({ x: 50, y: 90 }); // drawn on the unmoved canvas
  });

  it("moves the drawn cut-out the same way, and clears it without a placement", () => {
    const style = placementStyle({ from: { x: 0.5, y: 0.9 }, to: { x: 0.7, y: 0.9 }, scale: 0.5 });
    expect(style.transformOrigin).toBe("50% 90%");
    const [, across, down, scale] =
      /^translate\(([-\d.e]+)%, ([-\d.e]+)%\) scale\(([\d.]+)\)$/.exec(style.transform) ?? [];
    expect([across, down, scale].map((n) => Math.round(Number(n) * 1000) / 1000)).toEqual([20, 0, 0.5]);
    expect(placementStyle(undefined)).toEqual({ transform: "", transformOrigin: "" });
  });
});
