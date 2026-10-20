import { isDefined } from "../../util/ObjectUtils";

/** Asks the player for their webcam; rejects (after logging) if it is refused or unavailable. */
export const getCameraStream = async () => {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    console.error("Error accessing the camera: ", err);
    throw err;
  }
};

/** Each tracked person's feet position, keyed by their index in the segmentation. */
export type FeetPositions = {
  [personId: number]: FootPosition;
};

/** A person's feet position, both in pixels and as a percentage of the frame. */
export interface FootPosition {
  /** Position in pixels of the mask. */
  absolute: {
    /** Pixels from the left. */
    x: number;
    /** Pixels from the top. */
    y: number;
  };
  /** Position as a percentage of the frame, for placing over a differently sized layer. */
  percent: {
    /** Percentage of the width, from the left. */
    x: number;
    /** Percentage of the height, from the top. */
    y: number;
  };
}

/** Rows above the lowest opaque row that still count as "feet". */
const FEET_BAND_ROWS = 20;

/**
 * Locates a person's feet in a segmentation mask: the centre of the opaque pixels
 * in the band just above the mask's lowest opaque row.
 * @param offScreenThreshold_percent feet lower than this (% of height) count as off screen
 * @returns the feet position, or null if there is no person or they are off screen
 */
export function findFeet(
  personMask: Pick<ImageData, "data">,
  width: number,
  height: number,
  offScreenThreshold_percent?: number,
): FootPosition | null {
  const isOpaque = (x: number, y: number) => personMask.data[(y * width + x) * 4 + 3] > 0;
  const rowHasOpaque = (y: number) => {
    for (let x = 0; x < width; x++) if (isOpaque(x, y)) return true;
    return false;
  };

  // Runs on every camera frame, so scan with plain loops rather than allocating arrays
  let lowestY = height - 1;
  while (lowestY >= 0 && !rowHasOpaque(lowestY)) lowestY--;
  if (lowestY < 0) return null;

  const lowestY_percent = (100 * lowestY) / height;
  if (isDefined(offScreenThreshold_percent) && lowestY_percent > offScreenThreshold_percent) {
    return null;
  }

  const centerX = bandCentreX(isOpaque, width, lowestY);
  if (centerX === null) return null;
  return { absolute: { x: centerX, y: lowestY }, percent: { x: (100 * centerX) / width, y: lowestY_percent } };
}

/** Mean x of the opaque pixels in the feet band ending at lowestY, or null if there are none. */
const bandCentreX = (isOpaque: (x: number, y: number) => boolean, width: number, lowestY: number): number | null => {
  let total = 0;
  let count = 0;
  for (let y = lowestY; y > lowestY - FEET_BAND_ROWS && y > 0; y--) {
    for (let x = 0; x < width; x++) {
      if (isOpaque(x, y)) {
        total += x;
        count++;
      }
    }
  }
  return count === 0 ? null : total / count;
};
