import type { GameSceneBase } from "../../../entities/data/scenes/GameSceneData";
import type { GameData } from "../../../entities/data/GameData";
import { isDefined } from "../../../util/ObjectUtils";
import { getCameraStream } from "../../camera/CameraSupport";
import { isCalibrated } from "../../camera/FloorCalibration";

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

/** A scene's own settings, which its reset scenes share. */
type SceneSettings = Pick<GameSceneBase, "avatar" | "scene" | "resetScene">;

/** A scene, then each reset scene nested in it. */
const withResets = (scene: SceneSettings): SceneSettings[] => [
  scene,
  ...(scene.resetScene ? withResets(scene.resetScene) : []),
];

/** Every scene in the game, with the reset scenes nested in them. */
const allScenes = (gameData: GameData): SceneSettings[] =>
  [
    ...gameData.scenes,
    ...gameData.stages.flatMap((stage) => stage.scenes ?? []),
    ...gameData.stages.flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.scenes)),
  ].flatMap(withResets);

/**
 * The most the game asks of the camera, anywhere: `"required"` if any setting is `camera` with no fallback, else
 * `"enabled"` if any is `camera`, else `false`.
 */
const gameCameraRequirement = (gameData: GameData): "required" | "enabled" | false => {
  const cameras = [gameData.modules?.avatar, ...allScenes(gameData).map(({ avatar }) => avatar)].filter(
    (settings) => settings?.mode === "camera",
  );
  if (cameras.some((settings) => !isDefined(settings?.fallback))) return "required";
  return cameras.length > 0 ? "enabled" : false;
};

/** Whether any of the game's scenes is laid out on the calibrated floor. */
export const gameUsesFloor = (gameData: GameData): boolean =>
  gameData.modules?.scene === "2.5D" || allScenes(gameData).some(({ scene }) => scene === "2.5D");

/**
 * Whether the floor must be calibrated before the game can start: it has 2.5D scenes, the player has granted the
 * camera (people playing by mouse don't need it), and the chosen camera has no saved floor.
 */
export const calibrationNeeded = (gameData: GameData, cameraGranted: boolean, cameraKey: string): boolean =>
  cameraGranted && gameUsesFloor(gameData) && !isCalibrated(cameraKey);

/** The permissions a game can use, in the order to show them on its landing page. */
export const usedGamePermissions = (gameData: GameData): GamePermissionId[] =>
  gameCameraRequirement(gameData) ? ["camera"] : [];

/** The permissions a game can't start without. */
export const requiredGamePermissions = (gameData: GameData): GamePermissionId[] =>
  gameCameraRequirement(gameData) === "required" ? ["camera"] : [];

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
