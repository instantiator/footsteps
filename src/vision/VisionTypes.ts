/** A position in mask pixels, from the top left. */
export interface Point {
  /** Pixels from the left. */
  x: number;
  /** Pixels from the top. */
  y: number;
}

/** A rectangle in mask pixels, with an exclusive `right` and `bottom`. */
export interface PixelRect {
  /** The first column inside. */
  left: number;
  /** The first row inside. */
  top: number;
  /** The first column past the right edge. */
  right: number;
  /** The first row past the bottom edge. */
  bottom: number;
}

/** The points the game tracks on each person. */
export type KeyPointName =
  "leftFoot" | "rightFoot" | "leftHand" | "rightHand" | "headTop" | "headBottom" | "headLeft" | "headRight";

/** Each key point, or null where the model could not place it. Left and right are the person's own. */
export type KeyPoints = Record<KeyPointName, Point | null>;

/** One person, as a vision model saw them in a frame. */
export interface VisionPerson {
  /** Identifies the person within the frame, and across frames when tracking is on. */
  id: number;
  /** One byte per pixel, row by row: 1 where the pixel is this person, 0 elsewhere. */
  mask: Uint8Array;
  /** Where the person's hands, feet and head are. */
  keyPoints: KeyPoints;
  /** The radius of a hand or foot, in pixels, scaled to the person's size in the frame. */
  scale: number;
}

/**
 * What a vision model found in one camera frame.
 *
 * Plain data, with each mask in its own buffer, so a frame can be transferred from a worker.
 */
export interface VisionFrame {
  /** Mask width, in pixels. */
  width: number;
  /** Mask height, in pixels. */
  height: number;
  /** When the frame was taken, in milliseconds. */
  timestamp: number;
  /** Everyone found; empty if nobody was. */
  people: VisionPerson[];
}

/** A key points record with nothing placed, for models to fill in. */
export const noKeyPoints = (): KeyPoints => ({
  leftFoot: null,
  rightFoot: null,
  leftHand: null,
  rightHand: null,
  headTop: null,
  headBottom: null,
  headLeft: null,
  headRight: null,
});
