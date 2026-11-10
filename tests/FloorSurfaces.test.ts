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
  backgroundQuad,
  floorAreaQuad,
  groundQuad,
  horizonLine,
  horizonQuad,
  matrix3dFor,
  wallQuad,
  type Quad,
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
    expect(horizonQuad(view(false, flat), viewport)).toBeUndefined();
  });
});

describe("horizonQuad", () => {
  it("reaches from just below the horizon to above the viewport, slanting with it", () => {
    const tilted = view(false, LOPSIDED);
    const quad = horizonQuad(tilted, viewport)!;
    const line = horizonLine(tilted)!.map(({ x, y }) => ({ x: x * viewport.width, y: y * viewport.height })) as [
      Point,
      Point,
    ];
    expect(quad.frontLeft.y).toBeGreaterThan(lineY(line, quad.frontLeft.x));
    expect(quad.frontRight.y).toBeGreaterThan(lineY(line, quad.frontRight.x));
    expect(Math.max(quad.backLeft.y, quad.backRight.y)).toBeLessThan(0);
    expect(quad.backLeft.x).toBeLessThan(0);
    expect(quad.backRight.x).toBeGreaterThan(viewport.width);
    const slope = ({ x: ax, y: ay }: Point, { x: bx, y: by }: Point) => (by - ay) / (bx - ax);
    expect(slope(quad.backLeft, quad.backRight)).toBeCloseTo(slope(quad.frontLeft, quad.frontRight), 6);
    expect(slope(quad.frontLeft, quad.frontRight)).not.toBeCloseTo(0, 2);
  });
});

describe("wallQuad", () => {
  it("stands the rear wall on the back edge, raised by its height at that depth", () => {
    const quad = wallQuad(view(false), viewport, "rear", { height: 10, distance: 0 });
    const rise = 0.1 * rowLength(view(false), viewport, 0);
    close(quad.frontLeft, pixels(DEFAULT_CORNERS, { x: 0, y: 0 }));
    close(quad.frontRight, pixels(DEFAULT_CORNERS, { x: 100, y: 0 }));
    close(quad.backLeft, { x: quad.frontLeft.x, y: quad.frontLeft.y - rise });
    close(quad.backRight, { x: quad.frontRight.x, y: quad.frontRight.y - rise });
  });

  it("stands a side wall taller at the front than the back", () => {
    const quad = wallQuad(view(false), viewport, "left", { height: 10, distance: 0 });
    close(quad.frontLeft, pixels(DEFAULT_CORNERS, { x: 0, y: 100 }));
    close(quad.frontRight, pixels(DEFAULT_CORNERS, { x: 0, y: 0 }));
    expect(quad.frontLeft.y - quad.backLeft.y).toBeGreaterThan(quad.frontRight.y - quad.backRight.y);
  });

  it.each([false, true])("keeps the left wall on the screen's left (mirrored: %s)", (mirrored) => {
    const left = wallQuad(view(mirrored, LOPSIDED), viewport, "left", { height: 10, distance: 0 });
    const right = wallQuad(view(mirrored, LOPSIDED), viewport, "right", { height: 10, distance: 0 });
    expect(Math.max(left.frontLeft.x, left.frontRight.x)).toBeLessThan(Math.min(right.frontLeft.x, right.frontRight.x));
  });
});

describe("backgroundQuad", () => {
  it.each([DEFAULT_CORNERS, LOPSIDED])(
    "stands the rear background behind the wall, covering the top and sides",
    (corners) => {
      const quad = backgroundQuad(view(false, corners), viewport, "rear", 50);
      const wall = wallQuad(view(false, corners), viewport, "rear", { height: 10, distance: 0 });
      expect(quad.frontLeft.x).toBeLessThan(0);
      expect(quad.frontRight.x).toBeGreaterThan(viewport.width);
      expect(Math.max(quad.backLeft.y, quad.backRight.y)).toBeLessThan(0);
      expect((quad.frontLeft.y + quad.frontRight.y) / 2).toBeLessThan((wall.frontLeft.y + wall.frontRight.y) / 2);
    },
  );

  it("runs a side background from below the viewport back to the rear background, reaching above the top", () => {
    const quad = backgroundQuad(view(false), viewport, "left", 50);
    expect(quad.frontLeft.y).toBeGreaterThan(viewport.height);
    close(quad.frontRight, pixels(DEFAULT_CORNERS, { x: -50, y: -50 }));
    expect(Math.max(quad.backLeft.y, quad.backRight.y)).toBeLessThan(0);
  });
});

describe("groundQuad", () => {
  it.each([false, true])(
    "covers the viewport below the horizon, and stops just short of it (mirrored: %s)",
    (mirrored) => {
      for (const corners of [DEFAULT_CORNERS, LOPSIDED]) {
        const quad = groundQuad(view(mirrored, corners), viewport);
        const line = horizonLine(view(mirrored, corners))!.map(({ x, y }) => ({
          x: x * viewport.width,
          y: y * viewport.height,
        })) as [Point, Point];
        expect(quad.frontLeft.y).toBeGreaterThan(viewport.height);
        expect(quad.frontRight.y).toBeGreaterThan(viewport.height);
        expect(Math.min(quad.backLeft.x, quad.frontLeft.x)).toBeLessThan(0);
        expect(Math.max(quad.backRight.x, quad.frontRight.x)).toBeGreaterThan(viewport.width);
        for (const far of [quad.backLeft, quad.backRight]) {
          // Below the horizon (so in front of the camera), and within the horizon background's overlap of it
          expect(far.y).toBeGreaterThan(lineY(line, far.x));
          expect(far.y - lineY(line, far.x)).toBeLessThan(0.02 * viewport.height);
        }
      }
    },
  );
});
