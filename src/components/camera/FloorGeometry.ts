/**
 * Every conversion between the camera image, the screen and the floor. Nothing else in the code does this maths.
 *
 * - **Image fractions** run 0–1 across and down the camera's own, unmirrored image, whatever its resolution.
 * - **Mask pixels** are the vision model's, from the top left.
 * - **Screen pixels** are the browser viewport's. They reach the image through the camera canvas's on-screen
 *   rectangle, so cropping or mirroring the canvas changes nothing here.
 * - **Floor coordinates** run 0–100: x from the floor's left edge to its right at that depth, y from its back edge
 *   to its front.
 */
import type { Point } from "../../vision/VisionTypes";

/** The floor's four corners, in image fractions. */
export interface Corners {
  /** The far corner on the left of the camera image, before any mirroring. */
  backLeft: Point;
  /** The far right corner. */
  backRight: Point;
  /** The near right corner. */
  frontRight: Point;
  /** The near left corner. */
  frontLeft: Point;
}

/** A corner's name. */
export type CornerName = keyof Corners;

/** The corners in order around the floor, which is clockwise on screen. */
export const CORNER_NAMES: readonly CornerName[] = ["backLeft", "backRight", "frontRight", "frontLeft"];

/**
 * The corners before calibration. They are calculated for a 4:3 webcam with a 42° vertical field of view, 2 m high
 * and tilted down 22°: a floor about 2.6 m wide, from 2.5 m to 4.5 m away, with the whole body in frame at the back
 * and feet kept clear of the image's edges at the front. `camera-mode.md` gives the derivation.
 */
export const DEFAULT_CORNERS: Corners = {
  backLeft: { x: 0.25, y: 0.55 },
  backRight: { x: 0.75, y: 0.55 },
  frontRight: { x: 0.92, y: 0.9 },
  frontLeft: { x: 0.08, y: 0.9 },
};

/** A 3×3 matrix, by rows, acting on homogeneous points. */
type Matrix = [number, number, number, number, number, number, number, number, number];

/** Applies a projective matrix to a point. */
const project = ([a, b, c, d, e, f, g, h, i]: Matrix, { x, y }: Point): Point => {
  const w = g * x + h * y + i;
  return { x: (a * x + b * y + c) / w, y: (d * x + e * y + f) / w };
};

/** The matrix taking the unit square's corners (0,0), (1,0), (1,1), (0,1) to the floor's corners, in that order. */
const squareToQuad = ({ backLeft: p0, backRight: p1, frontRight: p2, frontLeft: p3 }: Corners): Matrix => {
  const [dx1, dx2, dx3] = [p1.x - p2.x, p3.x - p2.x, p0.x - p1.x + p2.x - p3.x];
  const [dy1, dy2, dy3] = [p1.y - p2.y, p3.y - p2.y, p0.y - p1.y + p2.y - p3.y];
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
    1,
  ];
};

/** A projective matrix's inverse, up to scale, which is all a projective matrix needs. */
const adjugate = ([a, b, c, d, e, f, g, h, i]: Matrix): Matrix => [
  e * i - f * h,
  c * h - b * i,
  b * f - c * e,
  f * g - d * i,
  a * i - c * g,
  c * d - a * f,
  d * h - e * g,
  b * g - a * h,
  a * e - b * d,
];

/** Conversions between floor coordinates and image fractions, for one set of corners. */
export interface FloorHomography {
  /** Where a floor point appears in the image. */
  toImage(floor: Point): Point;
  /** Which floor point an image point shows. */
  toFloor(image: Point): Point;
}

/**
 * The projective transform between the floor and the image that the corners define. Rows further back bunch
 * together, as they do on camera. The corners must be a valid floor ({@link isValidFloor}).
 */
export const floorHomography = (corners: Corners): FloorHomography => {
  const forward = squareToQuad(corners);
  const inverse = adjugate(forward);
  return {
    toImage: ({ x, y }) => project(forward, { x: x / 100, y: y / 100 }),
    toFloor: (image) => {
      const { x, y } = project(inverse, image);
      return { x: x * 100, y: y * 100 };
    },
  };
};

/** The smallest turn, in image fractions squared, that still counts as convex: it rules out collapsed corners. */
const MIN_TURN = 1e-4;

/** The z component of the cross product of two edges. */
const cross = (a: Point, b: Point, c: Point): number => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

/**
 * Whether the corners make a floor: inside the image, and strictly convex with the same winding as the defaults,
 * so the back can't cross the front and no edge folds back on itself.
 */
export const isValidFloor = (corners: Corners): boolean => {
  const points = CORNER_NAMES.map((name) => corners[name]);
  const inImage = points.every(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1);
  return inImage && points.every((point, i) => cross(points[(i + 3) % 4], point, points[(i + 1) % 4]) > MIN_TURN);
};

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Bisection steps when a drag hits the limit: 2⁻²⁰ of the drag is far below a pixel. */
const LIMIT_STEPS = 20;

/**
 * Moves one corner towards `target`. A move that would break the floor stops at the limit: the furthest point along
 * the way that still makes a valid floor. The valid positions for one corner are convex, so bisection finds it.
 * @param corners a valid floor
 */
export const dragCorner = (corners: Corners, name: CornerName, target: Point): Corners => {
  const from = corners[name];
  const to = { x: clamp01(target.x), y: clamp01(target.y) };
  const at = (t: number): Corners => ({
    ...corners,
    [name]: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
  });
  if (isValidFloor(at(1))) return at(1);
  let [valid, invalid] = [0, 1];
  for (let step = 0; step < LIMIT_STEPS; step++) {
    const mid = (valid + invalid) / 2;
    if (isValidFloor(at(mid))) valid = mid;
    else invalid = mid;
  }
  return at(valid);
};

/** The part of the camera image a 2.5D scene shows, in image fractions. It always starts at the image's top. */
export interface FloorCrop {
  /** The floor's leftmost point. */
  left: number;
  /** The floor's rightmost point. */
  right: number;
  /** The floor's lowest point. */
  bottom: number;
}

/** The crop that fits the floor: its width, from the image's top down to its lowest point. */
export const floorCrop = (corners: Corners): FloorCrop => {
  const points = CORNER_NAMES.map((name) => corners[name]);
  return {
    left: Math.min(...points.map(({ x }) => x)),
    right: Math.max(...points.map(({ x }) => x)),
    bottom: Math.max(...points.map(({ y }) => y)),
  };
};

/** The crop's width over its height, which the viewport takes in a 2.5D scene. */
export const cropAspect = ({ left, right, bottom }: FloorCrop, imageAspect: number): number =>
  ((right - left) * imageAspect) / bottom;

/** The camera image's width over its height when there is no camera: a typical webcam's. */
export const ASSUMED_IMAGE_ASPECT = 4 / 3;

/** Where the whole camera image sits so that the crop fills the viewport, as fractions of the viewport's size. */
export interface CropPlacement {
  /** The image's width. */
  width: number;
  /** The image's height. */
  height: number;
  /** The image's left edge, from the viewport's: zero or less. */
  left: number;
}

/**
 * Places the camera image so the crop fills the viewport: the floor spans its width, and its lowest point sits on the
 * bottom edge. A mirrored image is flipped about its own centre, so the crop's right edge lands on the viewport's left.
 */
export const cropPlacement = ({ left, right, bottom }: FloorCrop, mirrored: boolean): CropPlacement => {
  const width = 1 / (right - left);
  return { width, height: 1 / bottom, left: -(mirrored ? 1 - right : left) * width };
};

/** Whether an image point is on the floor. */
export const isOnFloor = (corners: Corners, image: Point): boolean => {
  const { x, y } = floorHomography(corners).toFloor(image);
  return x >= 0 && x <= 100 && y >= 0 && y <= 100;
};

/** A rectangle in viewport coordinates, with edges in pixels. */
export interface Rect {
  /** Pixels from the left edge of the viewport. */
  left: number;
  /** Pixels from the top edge of the viewport. */
  top: number;
  /** Pixels from the left edge of the viewport to the right edge. */
  right: number;
  /** Pixels from the top edge of the viewport to the bottom edge. */
  bottom: number;
}

/** A mask's size, in pixels. */
export interface MaskSize {
  /** Pixels across. */
  width: number;
  /** Pixels down. */
  height: number;
}

/** A rectangle in mask pixels, with whole-pixel bounds and an exclusive `right` and `bottom`. */
export type MaskRect = Rect;

/** An empty mask rectangle, for elements that are not over the mask. */
export const EMPTY_MASK_RECT: MaskRect = { left: 0, top: 0, right: 0, bottom: 0 };

/** Clamps a value to the given whole-pixel range. */
const clampPixel = (value: number, max: number): number => Math.min(Math.max(Math.round(value), 0), max);

/**
 * Converts an element's viewport rectangle into the segmentation mask's pixel bounds.
 *
 * When the silhouette canvas is drawn mirrored (`scaleX(-1)`), the mask's x axis runs opposite to the
 * screen's: an element on the left of the screen covers the right of the mask. The mask may also be
 * a different size from the canvas, so both axes are scaled between them.
 *
 * NB. The bounds are clamped to the mask, so an element with no overlap yields an empty rectangle.
 */
export const maskRectForElement = (
  elementRect: Rect,
  canvasRect: Rect,
  { width: maskWidth, height: maskHeight }: MaskSize,
  mirrored: boolean,
): MaskRect => {
  const canvasWidth = canvasRect.right - canvasRect.left;
  const canvasHeight = canvasRect.bottom - canvasRect.top;
  if (canvasWidth <= 0 || canvasHeight <= 0 || maskWidth <= 0 || maskHeight <= 0) return EMPTY_MASK_RECT;

  // A mirrored canvas shows the mask flipped about its centre
  const fromLeft = mirrored ? canvasRect.right - elementRect.right : elementRect.left - canvasRect.left;
  const fromRight = mirrored ? canvasRect.right - elementRect.left : elementRect.right - canvasRect.left;
  const left = clampPixel((fromLeft / canvasWidth) * maskWidth, maskWidth);
  const right = clampPixel((fromRight / canvasWidth) * maskWidth, maskWidth);
  const top = clampPixel(((elementRect.top - canvasRect.top) / canvasHeight) * maskHeight, maskHeight);
  const bottom = clampPixel(((elementRect.bottom - canvasRect.top) / canvasHeight) * maskHeight, maskHeight);

  if (right <= left || bottom <= top) return EMPTY_MASK_RECT;
  return { left, top, right, bottom };
};

/**
 * Converts a point in mask pixels to the viewport point it is drawn at: the inverse of {@link maskRectForElement}.
 * The point is taken at the centre of its pixel.
 */
export const screenPointForMaskPoint = (
  point: Point,
  canvasRect: Rect,
  { width: maskWidth, height: maskHeight }: MaskSize,
  mirrored: boolean,
): Point => ({
  x: mirrored
    ? canvasRect.right - ((point.x + 0.5) / maskWidth) * (canvasRect.right - canvasRect.left)
    : canvasRect.left + ((point.x + 0.5) / maskWidth) * (canvasRect.right - canvasRect.left),
  y: canvasRect.top + ((point.y + 0.5) / maskHeight) * (canvasRect.bottom - canvasRect.top),
});

/** Converts a viewport point to where it is in mask pixels, even if that is outside the mask. */
export const maskPointForScreenPoint = (
  point: Point,
  canvasRect: Rect,
  { width: maskWidth, height: maskHeight }: MaskSize,
  mirrored: boolean,
): Point => {
  const fromLeft = mirrored ? canvasRect.right - point.x : point.x - canvasRect.left;
  return {
    x: (fromLeft / (canvasRect.right - canvasRect.left)) * maskWidth,
    y: ((point.y - canvasRect.top) / (canvasRect.bottom - canvasRect.top)) * maskHeight,
  };
};
