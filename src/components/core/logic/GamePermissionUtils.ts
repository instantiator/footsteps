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

/** The session storage key that remembers a permission the player granted in this tab. */
const sessionGrantKey = (id: GamePermissionId): string => `footsteps:permission-granted:${id}`;

/** Whether the player granted the permission in this tab; storage that can't be read counts as not. */
const wasGrantedThisSession = (id: GamePermissionId): boolean => {
  try {
    return sessionStorage.getItem(sessionGrantKey(id)) === "true";
  } catch {
    return false;
  }
};

/** Remembers a grant for this tab, for browsers that can't report it afterwards. */
const rememberGrant = (id: GamePermissionId): void => {
  try {
    sessionStorage.setItem(sessionGrantKey(id), "true");
  } catch (error) {
    console.warn(`Could not remember the ${gamePermissionLabel(id)} grant; the player will be asked again:`, error);
  }
};

/**
 * Checks a permission with the browser, reporting it as unsupported when the browser cannot answer.
 * A grant the player made in this tab counts unless the browser now says it's denied, since some
 * browsers can't report the camera, or forget a grant they weren't asked to keep.
 */
export const checkGamePermission = async (id: GamePermissionId): Promise<GamePermissionState> => {
  let state: GamePermissionState;
  try {
    state = (await navigator.permissions.query({ name: id })).state;
  } catch (error) {
    console.warn(`Could not check the ${gamePermissionLabel(id)} permission:`, error);
    state = "unsupported";
  }
  return state !== "denied" && wasGrantedThisSession(id) ? "granted" : state;
};

/** Requests a permission from the player, then stops any media stream it opened. */
export const requestGamePermission = async (id: GamePermissionId): Promise<GamePermissionState> => {
  try {
    const stream = await getCameraStream();
    stream.getTracks().forEach((track) => track.stop());
    rememberGrant(id);
  } catch {
    // Refused or unavailable: the browser's state says which
  }
  return checkGamePermission(id);
};
