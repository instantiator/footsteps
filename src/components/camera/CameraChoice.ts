/** The player's choice of camera on the landing page, kept between visits. */
export interface CameraChoice {
  /** The camera to use; the system default when omitted. */
  deviceId?: string;
  /** Whether to flip the picture like a mirror, for a camera facing the player; off for a camera behind them. */
  mirror: boolean;
}

/** The local storage key that holds the player's {@link CameraChoice}. */
const CAMERA_CHOICE_KEY = "footsteps:camera-choice";

/** The saved choice; storage that can't be read or holds anything unexpected counts as no choice. */
export const loadCameraChoice = (): CameraChoice => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CAMERA_CHOICE_KEY) ?? "{}");
    if (typeof saved !== "object" || saved === null) return { mirror: false };
    const deviceId = "deviceId" in saved && typeof saved.deviceId === "string" ? saved.deviceId : undefined;
    return { deviceId, mirror: "mirror" in saved && saved.mirror === true };
  } catch {
    return { mirror: false };
  }
};

/** Saves the choice for the game and for later visits. */
export const saveCameraChoice = (choice: CameraChoice): void => {
  try {
    localStorage.setItem(CAMERA_CHOICE_KEY, JSON.stringify(choice));
  } catch (error) {
    console.warn("Could not save the camera choice; the game will use the default:", error);
  }
};
