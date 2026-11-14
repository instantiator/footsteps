import { describe, expect, it } from "vitest";
import {
  cropPlacement,
  DEFAULT_CORNERS,
  floorCrop,
  floorToViewport,
  rowLength,
  type Corners,
  type FloorView,
} from "../src/components/camera/FloorGeometry";
import {
  floorAreaQuad,
  floorBackgroundSurface,
  HORIZON_DISTANCE,
  horizonLine,
  horizonSurface,
  matrix3dFor,
  uprightSurface,
  type Quad,
  type Upright,
} from "../src/components/camera/FloorSurfaces";
import type { Point } from "../src/vision/VisionTypes";

/** A camera that isn't centred on the play space: every corner placed differently. */
const LOPSIDED: Corners = {
  backLeft: { x: 0.3, y: 0.4 },
  backRight: { x: 0.65, y: 0.5 },
  frontRight: { x: 0.97, y: 0.95 },
  frontLeft: { x: 0.12, y: 0.8 },
};

const view = (mirrored: boolean, corners: Corners = DEFAULT_CORNERS): FloorView => ({
  corners,
  crop: cropPlacement(floorCrop(corners), mirrored),
  mirrored,
});
const viewport = { width: 1240, height: 1000 };

const pixels = (corners: Corners, floor: Point, mirrored = false): Point => {
  const { x, y } = floorToViewport(view(mirrored, corners), floor);
  return { x: x * viewport.width, y: y * viewport.height };
};

const close = (actual: Point, expected: Point) => {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
};

/** Where a CSS `matrix3d` (with `transform-origin: 0 0`) puts a point of the box. */
const transformed = (css: string, { x, y }: Point): Point => {
  const m = css.slice("matrix3d(".length, -1).split(",").map(Number);
  const w = m[3] * x + m[7] * y + m[15];
  return { x: (m[0] * x + m[4] * y + m[12]) / w, y: (m[1] * x + m[5] * y + m[13]) / w };
};

/** The y of the line through two points at a given x. */
const lineY = ([a, b]: [Point, Point], x: number): number => a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);

/** Where two lines, each through two points, cross. */
const crossing = ([a, b]: [Point, Point], [c, d]: [Point, Point]): Point => {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  const [p, q] = [a.x * b.y - a.y * b.x, c.x * d.y - c.y * d.x];
  return {
    x: (p * (c.x - d.x) - (a.x - b.x) * q) / denominator,
    y: (p * (c.y - d.y) - (a.y - b.y) * q) / denominator,
  };
};

describe("matrix3dFor", () => {
  const quad: Quad = {
    backLeft: { x: 300, y: 100 },
    backRight: { x: 700, y: 140 },
    frontRight: { x: 900, y: 600 },
    frontLeft: { x: 100, y: 500 },
  };

  it("draws the box's corners onto the quad's", () => {
    const css = matrix3dFor({ width: 200, height: 100 }, quad);
    expect(css).toMatch(/^matrix3d\(/);
    close(transformed(css!, { x: 0, y: 0 }), quad.backLeft);
    close(transformed(css!, { x: 200, y: 0 }), quad.backRight);
    close(transformed(css!, { x: 200, y: 100 }), quad.frontRight);
    close(transformed(css!, { x: 0, y: 100 }), quad.frontLeft);
  });

  it("gives nothing for a quad collapsed to a point", () => {
    const point = { x: 5, y: 5 };
    expect(
      matrix3dFor(
        { width: 10, height: 10 },
        { backLeft: point, backRight: point, frontRight: point, frontLeft: point },
      ),
    ).toBeUndefined();
  });
});

describe("floorAreaQuad", () => {
  it.each([false, true])("puts the whole floor on the floor's own corners (mirrored: %s)", (mirrored) => {
    const quad = floorAreaQuad(view(mirrored, LOPSIDED), viewport, { left: 0, back: 0, right: 100, front: 100 });
    close(quad.backLeft, pixels(LOPSIDED, { x: 0, y: 0 }, mirrored));
    close(quad.backRight, pixels(LOPSIDED, { x: 100, y: 0 }, mirrored));
    close(quad.frontRight, pixels(LOPSIDED, { x: 100, y: 100 }, mirrored));
    close(quad.frontLeft, pixels(LOPSIDED, { x: 0, y: 100 }, mirrored));
  });
});

describe("horizonLine", () => {
  it("is level and about 4% below the viewport's top with the default corners", () => {
    const line = horizonLine(view(false))!;
    // The side edges meet where (0.08, 0.9) → (0.25, 0.55) reaches x 0.5, in an image cropped at 0.9
    const expected = (0.9 - (0.35 * 0.42) / 0.17) / 0.9;
    expect(line[0].y).toBeCloseTo(expected, 4);
    expect(line[1].y).toBeCloseTo(expected, 4);
  });

  it.each([false, true])("passes through the floor's vanishing points when lopsided (mirrored: %s)", (mirrored) => {
    const line = horizonLine(view(mirrored, LOPSIDED))!;
    const at = (floor: Point) => floorToViewport(view(mirrored, LOPSIDED), floor);
    const sides = crossing([at({ x: 0, y: 0 }), at({ x: 0, y: 100 })], [at({ x: 100, y: 0 }), at({ x: 100, y: 100 })]);
    const ends = crossing([at({ x: 0, y: 0 }), at({ x: 100, y: 0 })], [at({ x: 0, y: 100 }), at({ x: 100, y: 100 })]);
    expect(lineY(line, sides.x)).toBeCloseTo(sides.y, 4);
    expect(lineY(line, ends.x)).toBeCloseTo(ends.y, 4);
    expect(line[0].y).not.toBeCloseTo(line[1].y, 2);
  });

  it("is missing when the floor has no vanishing point", () => {
    const flat: Corners = {
      backLeft: { x: 0.1, y: 0.2 },
      backRight: { x: 0.9, y: 0.2 },
      frontRight: { x: 0.9, y: 0.9 },
      frontLeft: { x: 0.1, y: 0.9 },
    };
    expect(horizonLine(view(false, flat))).toBeUndefined();
    expect(horizonSurface(view(false, flat), viewport, HORIZON_DISTANCE)).toBeUndefined();
  });
});

/** A wall with nothing set: its box's shape sets its height. */
const WALL: Upright = { side: "rear", distance: 0, aspect: 0.1, fillHeight: false, fillWidth: false, fillEdge: "far" };

/** How far a quad's top edge is above the viewport's top at its left and right ends, in pixels. */
const topsOf = ({ backLeft, backRight }: Quad) => [backLeft.y, backRight.y];

describe("uprightSurface", () => {
  it("stands a rear wall on the back edge, as high as its box's shape makes it, leaving its box alone", () => {
    const { quad, extent } = uprightSurface(view(false), viewport, WALL);
    // A box a tenth as high as it is wide, along the floor's 100 wide back edge: 10 high
    const rise = 0.1 * rowLength(view(false), viewport, 0);
    close(quad.frontLeft, pixels(DEFAULT_CORNERS, { x: 0, y: 0 }));
    close(quad.frontRight, pixels(DEFAULT_CORNERS, { x: 100, y: 0 }));
    close(quad.backLeft, { x: quad.frontLeft.x, y: quad.frontLeft.y - rise });
    expect(extent).toBeUndefined();
  });

  it("stands a wall at a set height instead, with a box the engine sizes to match", () => {
    const { quad, extent } = uprightSurface(view(false), viewport, { ...WALL, height: 25 });
    expect(quad.frontLeft.y - quad.backLeft.y).toBeCloseTo(0.25 * rowLength(view(false), viewport, 0), 4);
    expect(extent).toEqual({ width: 100, height: 25 });
  });

  it("runs a background further out, meeting the side backgrounds at the corners", () => {
    const rear = uprightSurface(view(false), viewport, { ...WALL, distance: 50 }).quad;
    const left = uprightSurface(view(false), viewport, { ...WALL, side: "left", distance: 50 }).quad;
    close(rear.frontLeft, pixels(DEFAULT_CORNERS, { x: -50, y: -50 }));
    close(left.frontRight, rear.frontLeft);
    close(left.frontLeft, pixels(DEFAULT_CORNERS, { x: -50, y: 100 }));
  });

  it.each([DEFAULT_CORNERS, LOPSIDED])("fills a rear surface up to the top and out to the sides", (corners) => {
    const { quad, extent } = uprightSurface(view(false, corners), viewport, {
      ...WALL,
      distance: 50,
      fillHeight: true,
      fillWidth: true,
    });
    expect(Math.max(...topsOf(quad))).toBeLessThan(0);
    expect(quad.frontLeft.x).toBeLessThan(0);
    expect(quad.frontRight.x).toBeGreaterThan(viewport.width);
    expect(extent!.width).toBeGreaterThan(200);
  });

  it("fills a side wall's height from its far end by default, so its top never shows, or from its near end", () => {
    const far = uprightSurface(view(false), viewport, { ...WALL, side: "left", fillHeight: true }).quad;
    // The far end is on the right of a left wall, as seen on screen
    expect(far.backRight.y).toBeCloseTo(-0.01 * viewport.height, 4);
    expect(far.backLeft.y).toBeLessThan(0);
    const near = uprightSurface(view(false), viewport, { ...WALL, side: "left", fillHeight: true, fillEdge: "near" });
    expect(near.quad.backLeft.y).toBeCloseTo(-0.01 * viewport.height, 4);
    expect(near.quad.backRight.y).toBeGreaterThan(0);
  });

  it.each([false, true])("keeps the left wall on the screen's left (mirrored: %s)", (mirrored) => {
    const left = uprightSurface(view(mirrored, LOPSIDED), viewport, { ...WALL, side: "left" }).quad;
    const right = uprightSurface(view(mirrored, LOPSIDED), viewport, { ...WALL, side: "right" }).quad;
    expect(Math.max(left.frontLeft.x, left.frontRight.x)).toBeLessThan(Math.min(right.frontLeft.x, right.frontRight.x));
  });
});

describe("horizonSurface", () => {
  it.each([DEFAULT_CORNERS, LOPSIDED])("fills the viewport above its base, slanting with the floor", (corners) => {
    const quad = horizonSurface(view(false, corners), viewport, HORIZON_DISTANCE)!;
    expect(Math.max(...topsOf(quad))).toBeLessThan(0);
    expect(quad.frontLeft.x).toBeLessThan(0);
    expect(quad.frontRight.x).toBeGreaterThan(viewport.width);
    const line = horizonLine(view(false, corners))!.map(({ x, y }) => ({
      x: x * viewport.width,
      y: y * viewport.height,
    }));
    // Its base is just below the horizon, as far back as it stands
    expect(quad.frontLeft.y).toBeGreaterThan(lineY([line[0], line[1]], quad.frontLeft.x));
  });
});

describe("floorBackgroundSurface", () => {
  it.each([false, true])("covers the viewport from the horizon background down (mirrored: %s)", (mirrored) => {
    for (const corners of [DEFAULT_CORNERS, LOPSIDED]) {
      const shown = view(mirrored, corners);
      const { quad, extent } = floorBackgroundSurface(shown, viewport, { depth: 0, distance: HORIZON_DISTANCE });
      const horizon = horizonSurface(shown, viewport, HORIZON_DISTANCE)!;
      expect(quad.frontLeft.y).toBeGreaterThan(viewport.height);
      expect(quad.frontRight.y).toBeGreaterThan(viewport.height);
      expect(Math.min(quad.backLeft.x, quad.frontLeft.x)).toBeLessThan(0);
      expect(Math.max(quad.backRight.x, quad.frontRight.x)).toBeGreaterThan(viewport.width);
      // Its far edge is the horizon background's base, which reaches below it so no gap shows
      const base = [horizon.frontLeft, horizon.frontRight] as [Point, Point];
      for (const far of [quad.backLeft, quad.backRight]) expect(lineY(base, far.x)).toBeGreaterThan(far.y);
      // It reaches from the horizon background past the floor's front, and the camera sees every corner of it
      expect(extent!.height).toBeGreaterThanOrEqual(HORIZON_DISTANCE + 100);
      expect(matrix3dFor({ width: extent!.width, height: extent!.height }, quad)).toBeDefined();
    }
  });

  it("lies below the floor by its depth", () => {
    const flat = floorBackgroundSurface(view(false), viewport, { depth: 0, distance: HORIZON_DISTANCE }).quad;
    const lowered = floorBackgroundSurface(view(false), viewport, { depth: 10, distance: HORIZON_DISTANCE }).quad;
    expect(lowered.frontLeft.y).toBeGreaterThan(flat.frontLeft.y);
    expect(lowered.backLeft.y).toBeGreaterThan(flat.backLeft.y);
  });
});
