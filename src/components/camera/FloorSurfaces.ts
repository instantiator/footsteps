/**
 * Where floor surfaces appear on screen: tiles, walls, backgrounds, the ground and the horizon. Each is a quad, in
 * viewport pixels, that a box is drawn onto with a CSS `matrix3d`, so its content lies in the floor's perspective.
 * Coordinates are as `FloorGeometry.ts` defines them.
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
 * How far behind the floor's back edge the ground stops, in floor y units: far enough to look like the horizon, near
 * enough that it stays in front of the camera. `ponytail:` a constant; on a steep camera a gap below the horizon could
 * show, so measure the cut-off in pixels from the horizon if that happens.
 */
const GROUND_CUTOFF = 20000;

/** How far the horizon background reaches below the horizon, in viewport fractions, to tuck under the ground. */
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

/** Where a rectangle of the floor appears. */
export const floorAreaQuad = (view: FloorView, viewport: MaskSize, { left, back, right, front }: FloorArea): Quad =>
  quadOf(
    toPixels(view, viewport, { x: left, y: back }),
    toPixels(view, viewport, { x: right, y: back }),
    toPixels(view, viewport, { x: right, y: front }),
    toPixels(view, viewport, { x: left, y: front }),
  );

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

/** The ground line of an upright surface `distance` beyond one side of the floor, left then right as seen on screen. */
const sideLine = (side: FloorSide, distance: number): [Point, Point] => {
  const [near, far] = [-distance, 100 + distance];
  switch (side) {
    case "rear":
      return [
        { x: 0, y: near },
        { x: 100, y: near },
      ];
    case "front":
      return [
        { x: 0, y: far },
        { x: 100, y: far },
      ];
    case "left":
      return [
        { x: near, y: 100 },
        { x: near, y: 0 },
      ];
    case "right":
      return [
        { x: far, y: 0 },
        { x: far, y: 100 },
      ];
  }
};

/** Where a wall appears: upright along the full length of one side, `distance` beyond it. */
export const wallQuad = (
  view: FloorView,
  viewport: MaskSize,
  side: FloorSide,
  { height, distance }: { height: number; distance: number },
): Quad => uprightQuad(view, viewport, sideLine(side, distance), height);

/** The ground line of a background, in viewport fractions, stretched to the viewport's sides or bottom. */
const backgroundLine = (view: FloorView, side: Exclude<FloorSide, "front">, distance: number): [Point, Point] => {
  const [left, right] = sideLine(side, distance).map((point) => floorToViewport(view, point));
  if (side === "rear") return [alongLine(left, right, "x", -EDGE_MARGIN), alongLine(left, right, "x", 1 + EDGE_MARGIN)];
  // The side backgrounds run from below the viewport back to where the rear background stands, at the same distance
  const back = floorToViewport(
    view,
    side === "left" ? { x: -distance, y: -distance } : { x: 100 + distance, y: -distance },
  );
  const near = alongLine(left, right, "y", 1 + EDGE_MARGIN);
  return side === "left" ? [near, back] : [back, near];
};

/**
 * Where a background appears: a wall `distance` beyond one side of the floor, stretched along its ground line to the
 * viewport's edges and tall enough to reach above its top.
 */
export const backgroundQuad = (
  view: FloorView,
  viewport: MaskSize,
  side: Exclude<FloorSide, "front">,
  distance: number,
): Quad => {
  const base = backgroundLine(view, side, distance).map((point) => viewportToFloor(view, point));
  const height = Math.max(
    ...base.map((floor) => {
      const { y } = toPixels(view, viewport, floor);
      return (100 * (y + EDGE_MARGIN * viewport.height)) / rowLength(view, viewport, floor.y);
    }),
  );
  return uprightQuad(view, viewport, [base[0], base[1]], height);
};

/**
 * Where the ground appears: the floor's plane carried on beyond the viewport's sides and bottom, and back to just
 * short of the horizon. It is a rectangle of the floor, so whatever is drawn on it lies in the floor's perspective.
 */
export const groundQuad = (view: FloorView, viewport: MaskSize): Quad => {
  const [farLeft, farRight] = backgroundLine(view, "rear", GROUND_CUTOFF);
  const corners = [
    farLeft,
    farRight,
    { x: -EDGE_MARGIN, y: 1 + EDGE_MARGIN },
    { x: 1 + EDGE_MARGIN, y: 1 + EDGE_MARGIN },
  ].map((point) => viewportToFloor(view, point));
  const xs = corners.map(({ x }) => x);
  const front = Math.max(corners[2].y, corners[3].y);
  return floorAreaQuad(view, viewport, { left: Math.min(...xs), back: -GROUND_CUTOFF, right: Math.max(...xs), front });
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
 * Where the horizon background appears: from just below the horizon up past the viewport's top, as wide as the
 * viewport and slanting with the horizon.
 * @returns undefined when there is no horizon, or it is above the viewport
 */
export const horizonQuad = (view: FloorView, viewport: MaskSize): Quad | undefined => {
  const line = horizonLine(view);
  if (!line) return undefined;
  const [left, right] = [-EDGE_MARGIN, 1 + EDGE_MARGIN].map((x) => {
    const { y } = alongLine(line[0], line[1], "x", x);
    return { x, y: y + HORIZON_OVERLAP };
  });
  if (left.y < 0 && right.y < 0) return undefined;
  const rise = Math.max(left.y, right.y) + EDGE_MARGIN;
  const pixels = ({ x, y }: Point): Point => ({ x: x * viewport.width, y: y * viewport.height });
  const up = (point: Point): Point => pixels({ x: point.x, y: point.y - rise });
  return quadOf(up(left), up(right), pixels(right), pixels(left));
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
