import type {
  GameAvatarMode,
  GameInteraction,
  GameSceneAvatarData,
  GameSceneMode,
} from "../../../entities/data/scenes/GameSceneData";
import type { GameAvatarFeetData } from "../../../entities/data/scenes/GameAvatarFeetData";
import type { GameSpectatorsData } from "../../../entities/data/scenes/GameSpectatorsData";
import { POINTER_INTERACTIONS } from "../../../entities/data/scenes/GameSceneData";
import type { GameData } from "../../../entities/data/GameData";
import { isDefined } from "../../../util/ObjectUtils";
import type { LayeredGameSceneRenderData } from "./RenderDataUtils";

/** Whether camera mode and its preview are on for the scenes currently shown. */
export interface ResolvedCameraMode {
  /** Whether camera mode is on. */
  enabled: boolean;
  /** Whether the webcam preview shows. */
  preview: boolean;
}

/** The avatar settings for the scenes currently shown. */
export interface ResolvedAvatarMode {
  /** What stands in for the player. */
  mode: GameAvatarMode;
  /** The mode to use if the camera can't start; undefined if the camera is required. */
  fallback: GameSceneAvatarData["fallback"];
  /** Whether the webcam preview shows; always false unless the mode is `camera`. */
  preview: boolean;
  /** How the pointer's feet look in `mouse-feet` mode, with every default filled in. */
  feet: ResolvedFeet;
}

/** The pointer's feet settings, with every default filled in. */
export type ResolvedFeet = Required<Omit<GameAvatarFeetData, "imageResource">> &
  Pick<GameAvatarFeetData, "imageResource">;

/** The feet settings no scene sets. */
export const FEET_DEFAULTS: ResolvedFeet = { size: 6, color: "rgba(255, 255, 255, 0.6)", pointer: "shown" };

/** An avatar mode and the fallback that goes with it. */
type AvatarChoice = Pick<ResolvedAvatarMode, "mode" | "fallback">;

/** Avatar modes, weakest first: among active challenges, the strongest wins. */
const MODE_STRENGTH: readonly GameAvatarMode[] = ["mouse", "mouse-feet", "camera"];

/** The interactions the pointer fires as player 1's feet in `mouse-feet` mode. */
export const MOUSE_FEET_INTERACTIONS = [
  "foot-enter",
  "foot-exit",
  "any-enter",
  "any-exit",
  "jump",
  "jump-from",
  "jump-onto",
] as const satisfies readonly GameInteraction[];

/** Whether an avatar mode can fire an interaction. Every mode fires the pointer's. */
export const canModeFire = (mode: GameAvatarMode, interaction: string): boolean => {
  const fired: readonly string[] =
    mode === "camera" ? [interaction] : mode === "mouse-feet" ? MOUSE_FEET_INTERACTIONS : [];
  const pointer: readonly string[] = POINTER_INTERACTIONS;
  return pointer.includes(interaction) || fired.includes(interaction);
};

/** The mode a setting declares, with its fallback, if it declares one. */
export const declaredChoice = (avatar: GameSceneAvatarData | undefined): AvatarChoice | undefined =>
  isDefined(avatar?.mode) ? { mode: avatar.mode, fallback: avatar.fallback } : undefined;

/**
 * A narrower scene's avatar settings over a broader one's: setting `mode` replaces the broader fallback too, while
 * `preview` and `feet` (key by key) inherit on their own.
 */
export const avatarOver = (
  broader: GameSceneAvatarData | undefined,
  narrower: GameSceneAvatarData | undefined,
): GameSceneAvatarData | undefined => {
  if (!isDefined(narrower)) return broader;
  const kept = isDefined(narrower.mode) ? { preview: broader?.preview } : broader;
  const feet =
    isDefined(broader?.feet) || isDefined(narrower.feet) ? { ...broader?.feet, ...narrower.feet } : undefined;
  return { ...kept, ...narrower, preview: narrower.preview ?? broader?.preview, feet };
};

/** The strongest of several choices, if any. */
const strongest = (choices: AvatarChoice[]): AvatarChoice | undefined =>
  choices.reduce<AvatarChoice | undefined>(
    (best, choice) =>
      !isDefined(best) || MODE_STRENGTH.indexOf(choice.mode) > MODE_STRENGTH.indexOf(best.mode) ? choice : best,
    undefined,
  );

/** The first value given, if any. */
const firstDefined = <T>(...values: (T | undefined)[]): T | undefined => values.find(isDefined);

/** Whether the preview is on: any challenge turning it on wins, then any turning it off, then the broader settings. */
const resolvePreview = (
  challenges: (GameSceneAvatarData | undefined)[],
  broader: (GameSceneAvatarData | undefined)[],
): boolean => {
  const values = challenges.map((avatar) => avatar?.preview).filter(isDefined);
  if (values.length > 0) return values.includes(true);
  return firstDefined(...broader.map((avatar) => avatar?.preview)) ?? true;
};

/**
 * Resolves the avatar settings for the scenes shown, most specific first.
 *
 * Mode, with its fallback: the strongest mode any active challenge declares (`camera`, then `mouse-feet`, then
 * `mouse`), else the stage scene's, the overview scene's, the game's `modules.avatar`, and finally `mouse`.
 *
 * Preview: any active challenge turning it on wins, then any turning it off, then the stage, overview and game, and
 * finally on. It is always off unless the mode is `camera`.
 *
 * Feet: the first active challenge with a setting, over the stage scene's, the overview scene's and the game's, key by
 * key, over the defaults.
 */
export const resolveAvatarMode = (gameData: GameData, renderData: LayeredGameSceneRenderData): ResolvedAvatarMode => {
  const challenges = (renderData.challengesRenderData ?? []).map((challenge) => challenge.avatar);
  const broader = [renderData.stageRenderData?.avatar, renderData.overviewRenderData?.avatar, gameData.modules?.avatar];
  const choice = strongest(challenges.map(declaredChoice).filter(isDefined)) ??
    firstDefined(...broader.map(declaredChoice)) ?? { mode: "mouse", fallback: undefined };
  const challenge = challenges.find((avatar) => isDefined(avatar?.feet));
  const feet = [...broader]
    .reverse()
    .concat(challenge)
    .reduce<ResolvedFeet>((resolved, avatar) => ({ ...resolved, ...avatar?.feet }), FEET_DEFAULTS);
  return { ...choice, preview: choice.mode === "camera" && resolvePreview(challenges, broader), feet };
};

/** Camera mode for an avatar mode, as the layout's camera layers take it. */
export const cameraModeOf = ({ mode, preview }: Pick<ResolvedAvatarMode, "mode" | "preview">): ResolvedCameraMode => ({
  enabled: mode === "camera",
  preview: mode === "camera" && preview,
});

/**
 * Resolves how the scenes shown are laid out: `2.5D` if any active challenge declares it, else `2D` if one declares
 * that, else the stage scene's, the overview scene's, the game's `modules.scene`, and finally `2D`.
 */
export const resolveSceneMode = (gameData: GameData, renderData: LayeredGameSceneRenderData): GameSceneMode => {
  const challenges = (renderData.challengesRenderData ?? []).map((challenge) => challenge.scene).filter(isDefined);
  if (challenges.length > 0) return challenges.includes("2.5D") ? "2.5D" : "2D";
  return (
    firstDefined(renderData.stageRenderData?.scene, renderData.overviewRenderData?.scene, gameData.modules?.scene) ??
    "2D"
  );
};

/**
 * Resolves how spectators show in the scenes shown: the first active challenge with a setting over the stage scene's,
 * the overview scene's and the game's `modules.spectators`, key by key.
 */
export const resolveSpectators = (gameData: GameData, renderData: LayeredGameSceneRenderData): GameSpectatorsData => {
  const challenge = renderData.challengesRenderData?.find(({ spectators }) => isDefined(spectators))?.spectators;
  return { ...broaderSpectators(gameData, renderData), ...challenge };
};

/** The spectator settings broader than the challenges': the game's, then the overview scene's and the stage's. */
const broaderSpectators = (gameData: GameData, renderData: LayeredGameSceneRenderData): GameSpectatorsData => ({
  ...gameData.modules?.spectators,
  ...renderData.overviewRenderData?.spectators,
  ...renderData.stageRenderData?.spectators,
});

/** The shown challenges whose own settings, over broader ones, reset them as a spectator returns elsewhere. */
export const challengesResetOnReturn = (
  gameData: GameData,
  renderData: LayeredGameSceneRenderData,
): LayeredGameSceneRenderData["challengesRenderData"] => {
  const broader = broaderSpectators(gameData, renderData);
  return renderData.challengesRenderData?.filter(
    ({ spectators }) => ({ ...broader, ...spectators }).resetOnReturn === true,
  );
};
