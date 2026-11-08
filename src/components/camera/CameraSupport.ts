import { isDefined } from "../../util/ObjectUtils";
import type { Point, VisionPerson } from "../../vision/VisionTypes";

/** Whether an error means the camera asked for isn't there (eg. unplugged), rather than that it was refused or busy. */
const isMissingCamera = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  (error.name === "OverconstrainedError" || error.name === "NotFoundError");

/**
 * Asks the player for their webcam; rejects (after logging) if it is refused or unavailable.
 * @param size the resolution to ask for, which the camera may not give; the camera's default if omitted
 * @param deviceId the camera to use, falling back to the system default if it has gone; the system default if omitted
 */
export const getCameraStream = async (size?: { width: number; height: number }, deviceId?: string) => {
  const sized = size ? { width: { ideal: size.width }, height: { ideal: size.height } } : {};
  const defaultCamera = () => navigator.mediaDevices.getUserMedia({ video: size ? sized : true });
  try {
    if (deviceId === undefined) return await defaultCamera();
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { ...sized, deviceId: { exact: deviceId } } });
    } catch (err) {
      if (!isMissingCamera(err)) throw err;
      return await defaultCamera();
    }
  } catch (err) {
    console.error("Error accessing the camera: ", err);
    throw err;
  }
};

/** Stops every track in a stream, which turns the camera off. */
export const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

/** Each tracked person's feet position, keyed by their index in the segmentation. */
export type FeetPositions = {
  [personId: number]: FootPosition & {
    /** Whether the model has lost the person for a moment, so this is where their feet last were. */
    held?: boolean;
  };
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

/**
 * Where a person's feet are: midway between the feet the model placed, at the lower foot's height.
 * @param offScreenThreshold_percent feet lower than this (% of height) count as off screen
 * @returns the feet position, or null if neither foot was placed or they are off screen
 */
export function feetOf(
  { keyPoints }: Pick<VisionPerson, "keyPoints">,
  width: number,
  height: number,
  offScreenThreshold_percent?: number,
): FootPosition | null {
  const feet = [keyPoints.leftFoot, keyPoints.rightFoot].filter((foot): foot is Point => foot !== null);
  if (feet.length === 0 || width <= 0 || height <= 0) return null;

  const x = feet.reduce((total, foot) => total + foot.x, 0) / feet.length;
  const y = Math.max(...feet.map((foot) => foot.y));
  const percent = { x: (100 * x) / width, y: (100 * y) / height };
  if (isDefined(offScreenThreshold_percent) && percent.y > offScreenThreshold_percent) return null;
  return { absolute: { x, y }, percent };
}
