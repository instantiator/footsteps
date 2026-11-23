import { isDefined } from "../../util/ObjectUtils";
import { sizeOf, type CameraChoice } from "./CameraChoice";
import { CORNER_NAMES, DEFAULT_CORNERS, isValidFloor, type Corners } from "./FloorGeometry";
import { isFloorSize, type FloorSize } from "./FloorSize";

/**
 * The local storage key holding each camera configuration's floor corners. They describe the room, not a game, so
 * every game shares them, and they are in image fractions, so changing the mirror setting doesn't invalidate them.
 */
const CALIBRATION_KEY = "footsteps:floor-calibrations";

/** The local storage key holding each camera configuration's measured floor size, which is optional. */
const FLOOR_SIZE_KEY = "footsteps:floor-sizes";

/** Where calibrations were kept before they were per configuration; they were taken at an unknown size, so dropped. */
const OLD_CALIBRATION_KEY = "footsteps:floor-calibration";

/**
 * The key a camera configuration's calibration is saved under: the camera and size chosen on the landing page, which
 * are the ones the preview, the calibration and the game ask for. A different size may be a different crop of the
 * camera's view, so it has its own floor. `ponytail:` "System default" is one camera, so changing the system's default
 * camera keeps its calibration. Key by the stream's resolved device id if that matters.
 */
export const cameraKeyOf = (choice: Pick<CameraChoice, "deviceId" | "size">): string => {
  const { width, height } = sizeOf(choice);
  return `${choice.deviceId ?? "default"}@${width}x${height}`;
};

/** Whether a stored value is a set of corners. */
const isCorners = (value: unknown): value is Corners =>
  typeof value === "object" &&
  value !== null &&
  CORNER_NAMES.every((name) => {
    const point: unknown = (value as Record<string, unknown>)[name];
    return (
      typeof point === "object" &&
      point !== null &&
      "x" in point &&
      "y" in point &&
      typeof point.x === "number" &&
      typeof point.y === "number"
    );
  });

/** Every value saved under a key, by camera key; storage that can't be read, or holds anything unexpected, is none. */
const loadStore = <T>(key: string, isValid: (value: unknown) => value is T): Record<string, T> => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (typeof saved !== "object" || saved === null) return {};
    return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, T] => isValid(entry[1])));
  } catch {
    return {};
  }
};

/** Whether a stored value is a usable set of corners. */
const isSavedCorners = (value: unknown): value is Corners => isCorners(value) && isValidFloor(value);

/** Every saved calibration. */
const loadAll = (): Record<string, Corners> => {
  try {
    localStorage.removeItem(OLD_CALIBRATION_KEY);
  } catch {
    return {};
  }
  return loadStore(CALIBRATION_KEY, isSavedCorners);
};

/** The camera configuration's measured floor size, if the player gave one. */
export const loadFloorSize = (cameraKey: string): FloorSize | undefined =>
  loadStore(FLOOR_SIZE_KEY, isFloorSize)[cameraKey];

/**
 * Saves the camera configuration's measured floor size, or forgets it when there is none.
 * @returns whether it was saved
 */
export const saveFloorSize = (cameraKey: string, size: FloorSize | undefined): boolean => {
  try {
    const all = loadStore(FLOOR_SIZE_KEY, isFloorSize);
    if (size) all[cameraKey] = size;
    else delete all[cameraKey];
    localStorage.setItem(FLOOR_SIZE_KEY, JSON.stringify(all));
    return true;
  } catch (error) {
    console.warn("Could not save the floor size:", error);
    return false;
  }
};

/** The camera's saved floor corners, if it has been calibrated. */
export const loadCalibration = (cameraKey: string): Corners | undefined => loadAll()[cameraKey];

/** The camera's floor corners: as calibrated, or the defaults. */
export const calibrationOrDefault = (cameraKey: string): Corners => loadCalibration(cameraKey) ?? DEFAULT_CORNERS;

/** Whether the camera has been calibrated. */
export const isCalibrated = (cameraKey: string): boolean => isDefined(loadCalibration(cameraKey));

/**
 * Saves the camera's floor corners for every game.
 * @returns whether they were saved
 */
export const saveCalibration = (cameraKey: string, corners: Corners): boolean => {
  try {
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify({ ...loadAll(), [cameraKey]: corners }));
    return true;
  } catch (error) {
    console.warn("Could not save the floor calibration:", error);
    return false;
  }
};

/** Forgets one camera configuration's calibration. */
export const forgetCalibration = (cameraKey: string): void => {
  try {
    const all = loadAll();
    delete all[cameraKey];
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(all));
    saveFloorSize(cameraKey, undefined);
  } catch (error) {
    console.warn("Could not forget the floor calibration:", error);
  }
};

/** Forgets every camera's calibration. */
export const forgetAllCalibrations = (): void => {
  try {
    localStorage.removeItem(CALIBRATION_KEY);
    localStorage.removeItem(FLOOR_SIZE_KEY);
  } catch (error) {
    console.warn("Could not forget the floor calibrations:", error);
  }
};
