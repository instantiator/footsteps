import { isDefined } from "../../util/ObjectUtils";

export const getCameraStream = async () => {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    console.error("Error accessing the camera: ", err);
    throw err;
  }
};

export type FeetPositions = {
  [personId: number]: FootPosition;
};

export interface FootPosition {
  absolute: { x: number; y: number };
  percent: { x: number; y: number };
}

export function findFeet(
  personMask: ImageData,
  width: number,
  height: number,
  offScreenThreshold_percent?: number,
): FootPosition | null {
  const data = personMask.data;
  let lowestY: number | undefined = undefined;
  const feetPixels: { x: number; y: number }[] = [];

  // Find the lowest y-coordinate
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        lowestY = y;
        break;
      }
    }
    if (isDefined(lowestY)) {
      break;
    }
  }

  if (lowestY === undefined) {
    return null; // No pixels found
  }

  const lowestY_percent = (100 * lowestY) / height;
  if (isDefined(offScreenThreshold_percent) && lowestY_percent > offScreenThreshold_percent) {
    return null; // lowest pixels too close to the bottom
  }

  // Collect all pixels at the lowest y-coordinate band
  for (let y = lowestY; y > lowestY - 20 && y > 0; y--) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        feetPixels.push({ x, y: y });
      }
    }
  }

  // Calculate the average x-coordinate of the feet pixels
  if (feetPixels.length > 0) {
    const totalX = feetPixels.reduce((sum, p) => sum + p.x, 0);
    const centerX = totalX / feetPixels.length;
    const centerX_percent = (100 * centerX) / width;
    return { absolute: { x: centerX, y: lowestY }, percent: { x: centerX_percent, y: lowestY_percent } };
  }

  return null;
}
