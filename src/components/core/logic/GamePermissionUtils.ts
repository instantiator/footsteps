import type { GameData } from "../../../entities/data/GameData";
import { getCameraStream } from "../../camera/CameraSupport";

/** A browser permission a game may need before it starts. */
export type GamePermissionId = "camera";

/** A permission's browser state, or `unsupported` when the browser cannot report it. */
export type GamePermissionState = PermissionState | "unsupported";

/** Human-readable labels for the permissions a game can require. */
const PERMISSION_LABELS: Record<GamePermissionId, string> = {
  camera: "Camera",
};

/** The human-readable name of a permission. */
export const gamePermissionLabel = (id: GamePermissionId): string => PERMISSION_LABELS[id];

/** Whether any part of the game enables camera mode. */
const gameUsesCamera = (gameData: GameData): boolean => {
  if (gameData.modules?.camera?.enabled === true) return true;

  const displays = [
    ...gameData.displays,
    ...gameData.stages.flatMap((stage) => stage.displays ?? []),
    ...gameData.stages.flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.displays)),
  ];
  return displays.some((display) => display.camera?.enabled === true);
};

/** The permissions a game needs before it starts, in the order to show them. */
export const requiredGamePermissions = (gameData: GameData): GamePermissionId[] =>
  gameUsesCamera(gameData) ? ["camera"] : [];

/** Checks a permission with the browser, reporting it as unsupported when the browser cannot answer. */
export const checkGamePermission = async (id: GamePermissionId): Promise<GamePermissionState> => {
  try {
    const status = await navigator.permissions.query({ name: id });
    return status.state;
  } catch (error) {
    console.warn(`Could not check the ${gamePermissionLabel(id)} permission:`, error);
    return "unsupported";
  }
};

/** Requests a permission from the player, then stops any media stream it opened. */
export const requestGamePermission = async (id: GamePermissionId): Promise<GamePermissionState> => {
  try {
    const stream = await getCameraStream();
    stream.getTracks().forEach((track) => track.stop());
    // Check again, as the prompt asks; a successful request stands if the browser cannot confirm it
    return (await checkGamePermission(id)) === "denied" ? "denied" : "granted";
  } catch {
    return checkGamePermission(id);
  }
};
