/**
 * Where floor surfaces appear on screen: tiles, walls, backgrounds, the floor background and the horizon. Each is a
 * quad, in viewport pixels, that a box is drawn onto with a CSS `matrix3d`, so its content lies in the floor's
 * perspective. Coordinates are as `FloorGeometry.ts` defines them.
 */
import type { Point } from "../../vision/VisionTypes";
import {
  adjugate,
  floorToViewport,
  imagePointForViewport,
  rowLength,
  squareToQuad,
  viewportPointForImage,
  viewportToFloor,
  type Corners,
  type FloorView,
  type MaskSize,
} from "./FloorGeometry";

/**
 * A quadrilateral on screen, in viewport pixels, that a box is drawn onto. It takes the floor's corner names for the
 * box's corners: `backLeft` is the box's top left, then clockwise.
 */
export type Quad = Corners;

const quadOf = (topLeft: Point, topRight: Point, bottomRight: Point, bottomLeft: Point): Quad => ({
  backLeft: topLeft,
  backRight: topRight,
  frontRight: bottomRight,
  frontLeft: bottomLeft,
});

/** A rectangle of the floor, in screen floor coordinates. */
export interface FloorArea {
  /** Its left edge's x. */
  left: number;
  /** Its back edge's y. */
  back: number;
  /** Its right edge's x. */
  right: number;
  /** Its front edge's y. */
  front: number;
}

/** A side of the floor that an upright surface stands on. */
export type FloorSide = "rear" | "left" | "right" | "front";

/** How far past the viewport's edges a surface that fills it reaches, in viewport fractions, so no seam shows. */
const EDGE_MARGIN = 0.01;

/**
 * How far behind the floor's back edge the horizon background stands when its distance isn't given, in floor units.
 * The floor background reaches back to it, so nothing shows between them.
 */
export const HORIZON_DISTANCE = 1000;

/** How far the horizon background reaches below its base, in viewport fractions, to tuck under a lowered floor. */
const HORIZON_OVERLAP = 0.02;

/** A screen floor point in viewport pixels. */
const toPixels = (view: FloorView, viewport: MaskSize, floor: Point): Point => {
  const { x, y } = floorToViewport(view, floor);
  return { x: x * viewport.width, y: y * viewport.height };
};

/** How far above the floor, in pixels, a point `height` floor x units up stands at depth `y`. */
const riseAt = (view: FloorView, viewport: MaskSize, y: number, height: number): number =>
  (height / 100) * rowLength(view, viewport, y);

/** The point on the line through `a` and `b` where one coordinate takes a value. */
const alongLine = (a: Point, b: Point, axis: "x" | "y", value: number): Point => {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

/** Where a rectangle of a plane `height` floor x units above the floor appears; below it when negative. */
const planeQuad = (
  view: FloorView,
  viewport: MaskSize,
  { left, back, right, front }: FloorArea,
  height: number,
): Quad => {
  const at = (x: number, y: number) => {
    const point = toPixels(view, viewport, { x, y });
    return { x: point.x, y: point.y - riseAt(view, viewport, y, height) };
  };
  return quadOf(at(left, back), at(right, back), at(right, front), at(left, front));
};

/** Where a rectangle of the floor appears. */
export const floorAreaQuad = (view: FloorView, viewport: MaskSize, area: FloorArea): Quad =>
  planeQuad(view, viewport, area, 0);

/**
 * Where an upright surface appears: it stands on the ground between two floor points, given left then right as seen
 * on screen, and rises `height` floor x units, each end scaled for its depth as floor items are. Upright means upright
 * on screen, which assumes the camera isn't rolled.
 */
export const uprightQuad = (
  view: FloorView,
  viewport: MaskSize,
  [left, right]: [Point, Point],
  height: number,
): Quad => {
  const [baseLeft, baseRight] = [left, right].map((point) => toPixels(view, viewport, point));
  const raise = (base: Point, { y }: Point) => ({ x: base.x, y: base.y - riseAt(view, viewport, y, height) });
  return quadOf(raise(baseLeft, left), raise(baseRight, right), baseRight, baseLeft);
};

/**
 * The ground line of an upright surface `distance` beyond one side of the floor, left then right as seen on screen.
 * Surfaces at the same distance meet at the corners: the rear and front run across from side to side, and the sides
 * run from the rear to the floor's front edge.
 */
const sideLine = (side: FloorSide, distance: number): [Point, Point] => {
  const [near, far] = [-distance, 100 + distance];
  switch (side) {
    case "rear":
      return [
        { x: near, y: near },
        { x: far, y: near },
      ];
    case "front":
      return [
        { x: near, y: far },
        { x: far, y: far },
      ];
    case "left":
      return [
        { x: near, y: 100 },
        { x: near, y: near },
      ];
    case "right":
      return [
        { x: far, y: near },
        { x: far, y: 100 },
      ];
  }
};

/** A ground line carried along to just past the viewport's sides. */
const acrossViewport = (view: FloorView, line: [Point, Point]): [Point, Point] => {
  const [left, right] = line.map((point) => floorToViewport(view, point));
  return [
    viewportToFloor(view, alongLine(left, right, "x", -EDGE_MARGIN)),
    viewportToFloor(view, alongLine(left, right, "x", 1 + EDGE_MARGIN)),
  ];
};

/** The height, in floor x units, that stands a point on the ground up to just above the viewport's top. */
const heightToTop = (view: FloorView, viewport: MaskSize, floor: Point): number => {
  const { y } = toPixels(view, viewport, floor);
  return Math.max(0, (100 * (y + EDGE_MARGIN * viewport.height)) / rowLength(view, viewport, floor.y));
};

/** How an upright surface (a wall, a background, or the horizon) stands. */
export interface Upright {
  /** The side of the floor it stands beyond. */
  side: FloorSide;
  /** How far beyond that side, in floor units. */
  distance: number;
  /** Its height in floor x units, if set; otherwise its box's shape sets it. */
  height?: number;
  /** Its box's height over its width, which sets its height when nothing else does. */
  aspect: number;
  /** Whether it reaches up to the viewport's top. */
  fillHeight: boolean;
  /** Whether it reaches across to the viewport's sides; only the rear and front can. */
  fillWidth: boolean;
  /** Which end of a side surface reaches the top when it fills the height: the far end never leaves a gap. */
  fillEdge: "near" | "far";
}

/** A surface's size in floor units. */
export interface Extent {
  /** Across, along the ground. */
  width: number;
  /** Up, or back along the floor. */
  height: number;
}

/** Where a surface appears, and its size in floor units when that, rather than its own box, sets its box's size. */
export interface Drawn {
  /** Where it appears. */
  quad: Quad;
  /** Its width and height in floor units, when the engine sizes its box. */
  extent?: Extent;
}

/** A ground line's length, in floor units. */
const lengthOf = ([a, b]: [Point, Point]): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * How high an upright surface stands, in floor x units: up to the viewport's top when it fills the height (a side
 * surface's chosen end, or a rear or front surface's higher end), else as set, else as its box's shape makes it.
 */
const uprightHeight = (
  view: FloorView,
  viewport: MaskSize,
  { side, height, aspect, fillHeight, fillEdge }: Upright,
  { base, line }: { base: [Point, Point]; line: [Point, Point] },
): number => {
  if (!fillHeight) return height ?? aspect * lengthOf(line);
  const tops = base.map((point) => heightToTop(view, viewport, point));
  if (side !== "left" && side !== "right") return Math.max(...tops);
  const [far, near] = base[0].y < base[1].y ? tops : [tops[1], tops[0]];
  return fillEdge === "far" ? far : near;
};

/**
 * Where an upright surface appears. Its height is set, or reaches the viewport's top, or comes from its box's shape and
 * its length. A surface whose height or width the engine works out has its box sized to match, so its content keeps
 * the floor's scale rather than stretching.
 */
export const uprightSurface = (view: FloorView, viewport: MaskSize, upright: Upright): Drawn => {
  const { side, distance, height, fillHeight, fillWidth } = upright;
  const line = sideLine(side, distance);
  const base = fillWidth && (side === "rear" || side === "front") ? acrossViewport(view, line) : line;
  const rise = uprightHeight(view, viewport, upright, { base, line });
  const sized = fillHeight || fillWidth || height !== undefined;
  return {
    quad: uprightQuad(view, viewport, base, rise),
    ...(sized && { extent: { width: lengthOf(base), height: rise } }),
  };
};

/**
 * Where the horizon background appears: a rear surface `distance` behind the floor, filling the viewport above it, and
 * reaching a little below its base to tuck under a lowered floor background.
 * @returns undefined when it is above the viewport
 */
export const horizonSurface = (view: FloorView, viewport: MaskSize, distance: number): Quad | undefined => {
  const base = acrossViewport(view, sideLine("rear", distance));
  if (base.every((point) => toPixels(view, viewport, point).y < 0)) return undefined;
  const quad = uprightQuad(view, viewport, base, Math.max(...base.map((point) => heightToTop(view, viewport, point))));
  const lower = ({ x, y }: Point): Point => ({ x, y: y + HORIZON_OVERLAP * viewport.height });
  return { ...quad, frontLeft: lower(quad.frontLeft), frontRight: lower(quad.frontRight) };
};

/**
 * Where the floor background appears: the plane `depth` floor x units below the floor, across the viewport from below
 * its bottom back to `distance` behind the floor, where the horizon background stands.
 */
export const floorBackgroundSurface = (
  view: FloorView,
  viewport: MaskSize,
  { depth, distance }: { depth: number; distance: number },
): Drawn => {
  const farLine = acrossViewport(view, sideLine("rear", distance));
  const nearCorners = [-EDGE_MARGIN, 1 + EDGE_MARGIN].map((x) => viewportToFloor(view, { x, y: 1 + EDGE_MARGIN }));
  const xs = [...farLine, ...nearCorners].map(({ x }) => x);
  const area = {
    left: Math.min(...xs),
    back: -distance,
    right: Math.max(...xs),
    front: Math.max(100, ...nearCorners.map(({ y }) => y)),
  };
  return {
    quad: planeQuad(view, viewport, area, -depth),
    extent: { width: area.right - area.left, height: area.front - area.back },
  };
};

/**
 * Where the horizon is, in viewport fractions, at the viewport's left and right edges: the line the floor's parallel
 * edges meet on. It is the image of the floor's line at infinity, the third row of the floor's inverse projection.
 * @returns undefined if the floor has no vanishing point, so the horizon is infinitely far up
 */
export const horizonLine = ({ corners, crop, mirrored }: FloorView): [Point, Point] | undefined => {
  const inverse = adjugate(squareToQuad(corners));
  const [a, b, c] = inverse.slice(6);
  if (Math.abs(b) <= 1e-9 * Math.abs(c)) return undefined;
  const at = (x: number): Point => {
    const image = imagePointForViewport({ x, y: 0 }, crop, mirrored);
    return viewportPointForImage({ x: image.x, y: -(a * image.x + c) / b }, crop, mirrored);
  };
  return [at(0), at(1)];
};

/**
 * The CSS `matrix3d` that draws a box of the given size onto a quad, with `transform-origin: 0 0`. The box is mapped
 * projectively, so its content is drawn in the quad's perspective.
 * @param quad relative to the box's own layout position
 * @returns undefined if the quad is degenerate
 */
export const matrix3dFor = ({ width, height }: MaskSize, quad: Quad): string | undefined => {
  const [a, b, c, d, e, f, g, h, i] = squareToQuad(quad);
  const columns = [a / width, d / width, 0, g / width, b / height, e / height, 0, h / height, 0, 0, i, 0, c, f, 0, i];
  const scaled = columns.map((value) => value / i);
  if (!scaled.every(Number.isFinite)) return undefined;
  return `matrix3d(${scaled.map((value) => Number(value.toPrecision(10))).join(", ")})`;
};
