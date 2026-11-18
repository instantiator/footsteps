import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETUP_CONSTANTS,
  DEFAULT_SETUP_INPUTS,
  planSetup,
  type SetupInputs,
} from "../src/components/setup/SetupCalculations";
import {
  projectPoint,
  projectSegment,
  roomEdges,
  screenScene,
  type CameraPose,
} from "../src/components/setup/SetupProjection";

/** A camera 2 m up, tilted down at a slope of 0.5, seeing ±0.5 across and ±0.4 up and down. */
const POSE: CameraPose = { position: [0, 0, 2], tiltSlope: 0.5, sv: 0.4, sh: 0.5 };

describe("projecting into the picture", () => {
  it("puts the aim point in the picture's centre", () => {
    const [x, y] = projectPoint(POSE, [0, 2 / 0.5, 0]) ?? [NaN, NaN];
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it("puts points to the right and above on the right and at the top", () => {
    const [x, y] = projectPoint(POSE, [1, 4, 2]) ?? [NaN, NaN];
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
  });

  it("leaves out points behind the camera", () => {
    expect(projectPoint(POSE, [0, -1, 2])).toBeUndefined();
    expect(projectSegment(POSE, [0, -1, 2], [1, -2, 2])).toBeUndefined();
  });

  it("cuts a line off where it passes behind the camera", () => {
    const ends = projectSegment(POSE, [1, -1, 0], [1, 4, 0]);
    expect(ends).toBeDefined();
    for (const value of ends?.flat() ?? []) expect(Number.isFinite(value)).toBe(true);
    expect(ends?.[1]).toEqual(projectPoint(POSE, [1, 4, 0]));
  });

  it("gives a room twelve edges", () => {
    expect(roomEdges(4, 5, 2.4)).toHaveLength(12);
  });
});

describe("what the screen shows", () => {
  const scene = (inputs: SetupInputs) =>
    screenScene(planSetup(inputs, DEFAULT_SETUP_CONSTANTS), inputs, DEFAULT_SETUP_CONSTANTS);

  it("fits a 4:3 picture to the screen's height, centred", () => {
    const { picture } = scene(DEFAULT_SETUP_INPUTS);
    expect(picture.height).toBeCloseTo(DEFAULT_SETUP_CONSTANTS.screenHeight);
    expect(picture.width).toBeCloseTo(0.68 * (4 / 3));
    expect(picture.x).toBeCloseTo((1.22 - picture.width) / 2);
  });

  it.each([
    ["the default room", DEFAULT_SETUP_INPUTS],
    ["a large room", { ...DEFAULT_SETUP_INPUTS, roomLength: 10, roomWidth: 8 }],
    ["a short room", { ...DEFAULT_SETUP_INPUTS, roomLength: 3.5, tallestPlayer: 1.6 }],
    ["a low ceiling", { ...DEFAULT_SETUP_INPUTS, roomLength: 10, ceiling: 1.8 }],
  ])("keeps the floor and the players inside the clear part of the picture in %s", (_, inputs) => {
    const { clear, floor, lines } = scene(inputs);
    const inside = ([x, y]: [number, number]) => {
      expect(x).toBeGreaterThanOrEqual(clear.x - 1e-6);
      expect(x).toBeLessThanOrEqual(clear.x + clear.width + 1e-6);
      expect(y).toBeGreaterThanOrEqual(clear.y - 1e-6);
      expect(y).toBeLessThanOrEqual(clear.y + clear.height + 1e-6);
    };
    expect(floor).toHaveLength(4);
    floor?.forEach(inside);
    for (const { x1, y1, x2, y2 } of lines.filter(({ kind }) => kind === "player")) {
      inside([x1, y1]);
      inside([x2, y2]);
    }
  });

  it("puts the floor's front edge on the bottom of the clear part", () => {
    const { clear, floor } = scene(DEFAULT_SETUP_INPUTS);
    const lowest = Math.max(...(floor ?? []).map(([, y]) => y));
    expect(lowest).toBeCloseTo(clear.y + clear.height, 6);
  });
});
