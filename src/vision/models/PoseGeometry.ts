import type { KeyPoints, Point } from "../VisionTypes";

/** A hand or foot's radius, as a fraction of the head's width. */
const PART_RADIUS_PER_HEAD_WIDTH = 0.4;

/** A hand or foot's radius when there is no head to measure, as a fraction of the frame height. */
const FALLBACK_RADIUS_PER_HEIGHT = 0.03;

// ponytail: head proportions from typical anatomy, not measured from the mask; measure it if heads look off
/** The head's height, as a multiple of its width. */
const HEAD_HEIGHT_PER_WIDTH = 1.3;
/** How much of the head's height is above the eyes. */
const HEAD_ABOVE_EYES = 0.45;

/** The mean of some points, or null if there are none. */
export const meanOf = (points: Point[]): Point | null => {
  if (points.length === 0) return null;
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
};

/** A head placed from pose landmarks. */
export interface PlacedHead {
  /** The head's extremes; empty if the landmarks to place them were missing. */
  head: Partial<KeyPoints>;
  /** The head's width, in pixels, if it was placed. */
  width?: number;
}

/** The head's key points and width, from pose landmarks: the ears are its sides, and its height scales with width. */
export const headFromLandmarks = (leftEar: Point | null, rightEar: Point | null, eyes: Point | null): PlacedHead => {
  if (!leftEar || !rightEar || !eyes) return { head: {} };
  const width = Math.abs(leftEar.x - rightEar.x);
  const height = HEAD_HEIGHT_PER_WIDTH * width;
  const top = eyes.y - HEAD_ABOVE_EYES * height;
  const side = (leftEar.y + rightEar.y) / 2;
  return {
    head: {
      headTop: { x: eyes.x, y: top },
      headBottom: { x: eyes.x, y: top + height },
      headLeft: { x: leftEar.x, y: side },
      headRight: { x: rightEar.x, y: side },
    },
    width,
  };
};

/** The radius of a hand or foot: scaled to the head where there is one, otherwise to the frame. */
export const partScale = (headWidth: number | undefined, frameHeight: number): number =>
  headWidth ? PART_RADIUS_PER_HEAD_WIDTH * headWidth : FALLBACK_RADIUS_PER_HEIGHT * frameHeight;
