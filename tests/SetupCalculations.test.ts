import { describe, expect, it } from "vitest";
import {
  cameraView,
  DEFAULT_SETUP_CONSTANTS,
  DEFAULT_SETUP_INPUTS,
  layoutAt,
  planSetup,
  type SetupConstants,
  type SetupInputs,
  type SetupLayout,
} from "../src/components/setup/SetupCalculations";

/** Degrees below horizontal from the camera to a point `drop` below it and `distance` away. */
const angleDown = (drop: number, distance: number) => (Math.atan2(drop, distance) * 180) / Math.PI;

/** Half the usable vertical view, in degrees. */
const halfView = (sv: number) => (Math.atan(sv) * 180) / Math.PI;

const inputs = (overrides: Partial<SetupInputs>): SetupInputs => ({ ...DEFAULT_SETUP_INPUTS, ...overrides });
const constants = (overrides: Partial<SetupConstants>): SetupConstants => ({
  ...DEFAULT_SETUP_CONSTANTS,
  ...overrides,
});

/** The view's top and bottom edges, and the angles down to the near feet and to just above both heads. */
const sightLines = (layout: SetupLayout, sv: number, tallest: number, headroom: number) => {
  const tilt = (Math.atan(layout.tiltSlope) * 180) / Math.PI;
  const h = layout.cameraHeight;
  const head = h - tallest - headroom;
  return {
    top: tilt - halfView(sv),
    bottom: tilt + halfView(sv),
    nearFeet: angleDown(h, layout.nearDistance),
    nearHead: angleDown(head, layout.nearDistance),
    farHead: angleDown(head, layout.farDistance),
  };
};

/** The tallest player fits head to toe at the front and the back. */
const expectEveryoneInView = (layout: SetupLayout, sv: number, tallest: number, headroom: number) => {
  const lines = sightLines(layout, sv, tallest, headroom);
  expect(lines.nearFeet).toBeLessThanOrEqual(lines.bottom + 1e-6);
  expect(lines.nearHead).toBeGreaterThanOrEqual(lines.top - 1e-6);
  expect(lines.farHead).toBeGreaterThanOrEqual(lines.top - 1e-6);
};

const LARGE_ROOM = inputs({ roomLength: 10, roomWidth: 8 });

/** The generic 4:3 webcam the docs' default floor assumes: 65° diagonal, which is 42° vertical. */
const WEBCAM_4_3 = { diagonalFov: 65, aspect: 4 / 3 };

describe("the camera's view", () => {
  it("takes a 65° 4:3 webcam to a 42° vertical field of view", () => {
    const { sv } = cameraView(inputs(WEBCAM_4_3), constants({ edgeInset: 0 }));
    expect(2 * halfView(sv)).toBeCloseTo(42, 0);
  });

  it("takes the default LifeCam HD-3000 at 16:9 to about 37° vertically", () => {
    const { sv } = cameraView(DEFAULT_SETUP_INPUTS, constants({ edgeInset: 0 }));
    expect(2 * halfView(sv)).toBeCloseTo(37, 0);
  });

  it("shrinks the usable view by the edge inset", () => {
    const full = cameraView(DEFAULT_SETUP_INPUTS, constants({ edgeInset: 0 }));
    const inset = cameraView(DEFAULT_SETUP_INPUTS, DEFAULT_SETUP_CONSTANTS);
    expect(inset.sv).toBeCloseTo(full.sv * 0.9);
    expect(inset.sh).toBeCloseTo(full.sh * 0.9);
  });

  it("prefers a measurement to the diagonal, and reports the diagonal it implies", () => {
    const measured = { distance: 1, width: 1 };
    const view = cameraView(inputs({ ...WEBCAM_4_3, measured, diagonalFov: 120 }), constants({ edgeInset: 0 }));
    expect(view.sh).toBeCloseTo(0.5);
    expect(view.sv).toBeCloseTo(0.375);
    expect(view.impliedDiagonalFov).toBeCloseTo(2 * halfView(0.625));
    expect(cameraView(DEFAULT_SETUP_INPUTS, DEFAULT_SETUP_CONSTANTS).impliedDiagonalFov).toBeUndefined();
  });
});

describe("planning a large room", () => {
  const result = planSetup(LARGE_ROOM);

  it("puts the near feet on the bottom of the view, with everyone in view", () => {
    const lines = sightLines(result, result.view.sv, 1.9, 0.1);
    expect(lines.nearFeet).toBeCloseTo(lines.bottom, 6);
    expectEveryoneInView(result, result.view.sv, 1.9, 0.1);
  });

  it("gives the floor its full size, capped by the shortest player", () => {
    expect(result.floorDepth).toBeCloseTo(2.5);
    expect(result.floorWidth).toBeCloseTo(2.5);
    expect(result.warnings).toEqual([]);
  });

  it("keeps the camera as low as it can go while staying above the heads", () => {
    expect(result.cameraHeight).toBeCloseTo(1.9 + 0.1);
  });

  it("goes only as high as a bigger floor needs", () => {
    const room = inputs({ roomLength: 4.2, tallestPlayer: 1.6 });
    const planned = planSetup(room);
    const areaAt = (h: number) => {
      const layout = layoutAt(h, planned.view, room, DEFAULT_SETUP_CONSTANTS);
      return layout.floorWidth * layout.floorDepth;
    };
    const largest = Math.max(...Array.from({ length: 131 }, (_, i) => areaAt(1.7 + i / 100)));
    expect(planned.cameraHeight).toBeGreaterThan(1.7);
    expect(planned.cameraHeight).toBeLessThan(DEFAULT_SETUP_CONSTANTS.maxCameraHeight);
    expect(planned.floorWidth * planned.floorDepth).toBeGreaterThanOrEqual(0.99 * largest);
    expect(areaAt(planned.cameraHeight - 0.01)).toBeLessThan(0.99 * largest);
  });

  it("leaves the spare length beyond the floor", () => {
    expect(result.marginBehind).toBe(0.5);
    expect(result.marginFar).toBeCloseTo(10 - 0.5 - result.farDistance);
    expect(result.marginFar).toBeGreaterThan(0.3);
  });
});

describe("planning a short room", () => {
  const room = inputs({ roomLength: 3.5, tallestPlayer: 1.6 });

  it("puts the far head on the top of the view, at the room's limit", () => {
    const view = cameraView(room, DEFAULT_SETUP_CONSTANTS);
    const layout = layoutAt(2, view, room, DEFAULT_SETUP_CONSTANTS);
    const lines = sightLines(layout, view.sv, 1.6, 0.1);
    expect(layout.farDistance).toBeCloseTo(3.5 - 0.5 - 0.3);
    expect(lines.farHead).toBeCloseTo(lines.top, 6);
    expect(lines.nearFeet).toBeCloseTo(lines.bottom, 6);
    expect(layout.floorDepth).toBeLessThan(2.5);
  });

  it("raises the camera to fit more floor", () => {
    const result = planSetup(room);
    const at2m = layoutAt(2, result.view, room, DEFAULT_SETUP_CONSTANTS);
    expect(result.cameraHeight).toBeGreaterThan(2);
    expect(result.floorDepth).toBeGreaterThan(at2m.floorDepth);
    expectEveryoneInView(result, result.view.sv, 1.6, 0.1);
  });
});

describe("the floor's width and margins", () => {
  it("fills a narrow room between its margins", () => {
    const result = planSetup(inputs({ roomLength: 10, roomWidth: 2.6, marginLeft: 0.5, marginRight: 0.1 }));
    expect(result.floorWidth).toBeCloseTo(2);
    expect(result.marginLeft).toBeCloseTo(0.5);
    expect(result.marginRight).toBeCloseTo(0.1);
  });

  it("centres the floor in the space between unequal margins", () => {
    const result = planSetup(inputs({ roomLength: 10, roomWidth: 4, marginLeft: 0.5, marginRight: 0.1 }));
    expect(result.floorWidth).toBeCloseTo(2.5);
    expect(result.marginLeft).toBeCloseTo(0.95);
    expect(result.marginRight).toBeCloseTo(0.55);
  });
});

describe("players' sizes", () => {
  it("caps the floor for a short player", () => {
    const result = planSetup(inputs({ roomLength: 10, roomWidth: 8, shortestPlayer: 0.8 }));
    expect(result.floorDepth).toBeCloseTo(2);
    expect(result.floorWidth).toBeCloseTo(2);
  });

  it("warns when the floor is small for the tallest player", () => {
    const result = planSetup(inputs({ roomLength: 3.2, roomWidth: 2.2, tallestPlayer: 2 }));
    expect(result.warnings).toContain("Players will be large for this floor.");
  });
});

describe("the camera's height and tilt", () => {
  it("keeps under the ceiling's clearance, and can go to the maximum without one", () => {
    const room = inputs({ roomLength: 3.5, tallestPlayer: 1.6 });
    expect(planSetup({ ...room, ceiling: 2.2 }).cameraHeight).toBeLessThanOrEqual(2 + 1e-9);
    expect(planSetup(room).cameraHeight).toBeGreaterThan(2.2);
  });

  it("fits the near head for a camera below head height, and warns", () => {
    const result = planSetup(inputs({ roomLength: 10, ceiling: 1.8 }));
    expect(result.cameraHeight).toBeLessThanOrEqual(1.6 + 1e-9);
    expectEveryoneInView(result, result.view.sv, 1.9, 0.1);
    expect(result.warnings).toContain("The camera is below head height, so players in front may hide those behind.");
  });

  it("warns when the ceiling is too low for the camera", () => {
    const result = planSetup(inputs({ ceiling: 1 }));
    expect(result.warnings).toContain("The ceiling is too low for the camera.");
  });

  it.each([
    ["a large room", LARGE_ROOM, DEFAULT_SETUP_CONSTANTS],
    ["a short room", inputs({ roomLength: 3.5, tallestPlayer: 1.6 }), DEFAULT_SETUP_CONSTANTS],
    ["a shallow limit", LARGE_ROOM, constants({ maxTilt: 15 })],
  ])("never tilts past the limit in %s", (_, room, limits) => {
    expect(planSetup(room, limits).tiltDegrees).toBeLessThanOrEqual(limits.maxTilt + 1e-6);
  });

  it("aims the picture's centre where the tilt meets the floor", () => {
    const result = planSetup(LARGE_ROOM);
    expect(result.aimPoint).toBeCloseTo(result.cameraHeight / Math.tan((result.tiltDegrees * Math.PI) / 180));
  });
});

describe("rooms without space", () => {
  it("warns, without producing NaN", () => {
    const result = planSetup(inputs({ roomLength: 1 }));
    expect(result.warnings[0]).toMatch(/^Not enough space/);
    for (const value of [result.floorDepth, result.floorWidth, result.nearDistance, result.tiltDegrees]) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("puts the floor right under a camera that sees straight down", () => {
    const room = inputs({ roomLength: 2.2, marginFar: 0.3, marginBehind: 0.5, tallestPlayer: 1 });
    const limits = constants({ maxTilt: 89.9 });
    const layout = layoutAt(3, cameraView(room, limits), room, limits);
    expect(Number.isFinite(layout.nearDistance)).toBe(true);
    expect(Number.isFinite(layout.tiltSlope)).toBe(true);
  });

  it("refuses a view too wide to model", () => {
    expect(() => planSetup(inputs({ diagonalFov: 179 }), constants({ edgeInset: 0 }))).toThrow(RangeError);
  });
});

describe("the documented default", () => {
  it("puts a 2 m camera's floor about 2.1 m away, tilted about 22°", () => {
    const room = inputs({ ...WEBCAM_4_3, roomLength: 10, roomWidth: 8, tallestPlayer: 1.8 });
    const limits = constants({ edgeInset: 0, maxFloorDepth: 2, maxFloorWidth: 2.6 });
    const view = cameraView(room, limits);
    const layout = layoutAt(2, view, room, limits);
    expect(layout.nearDistance).toBeCloseTo(2.1, 1);
    expect((Math.atan(layout.tiltSlope) * 180) / Math.PI).toBeCloseTo(22, 0);
  });
});
