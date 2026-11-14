import type { GameData } from "../../../entities/data/GameData";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { allScenes, gameCameraRequirement } from "./GamePermissionUtils";

/** What the camera badge says, from how much the game asks of the camera. */
const CAMERA_BADGES = { required: "Camera", enabled: "Camera optional", none: "No camera" } as const;

/** The scene modes in the order badges list them. */
const SCENE_MODES = ["2D", "2.5D"] as const;

/** The scene modes the game uses: its own setting and every scene's, or `2D` when none says. */
const sceneModes = (gameData: GameData): string[] => {
  const used = new Set([gameData.modules?.scene ?? "2D", ...allScenes(gameData).map(({ scene }) => scene)]);
  return SCENE_MODES.filter((mode) => used.has(mode));
};

/** What the sound badge says: whether the game has music, sound effects (its own or its rules'), both, or neither. */
const soundBadge = (gameData: GameData): string => {
  const { openingMusicResource, closingMusicResource, stageOpenedSoundResource, stageCompletedSoundResource } =
    gameData.sounds ?? {};
  const music = isDefined(openingMusicResource) || isDefined(closingMusicResource);
  const effects =
    isDefined(stageOpenedSoundResource) ||
    isDefined(stageCompletedSoundResource) ||
    allScenes(gameData).some(({ component }) =>
      (component.rules ?? []).some((rule) => rule.do.some((action) => "sound" in action)),
    );
  if (music && effects) return "Music and sound effects";
  if (music) return "Music";
  return effects ? "Sound effects" : "Silent";
};

/** How much of a saved game is done, as a whole percentage of its challenges. */
const percentComplete = (saved: GameState): number => {
  const challenges = saved.stages.flatMap((stage) => stage.challengeStates);
  const done = challenges.filter((challenge) => challenge.succeeded).length;
  return challenges.length === 0 ? 0 : Math.round((done / challenges.length) * 100);
};

/** "1 stage", "3 stages". */
const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * The badges a game shows, worked out from its data and saved progress so authors don't write them: its scene modes,
 * its use of the camera, its size, how far a saved game has got (only when there is one), and its sound.
 */
export const gameBadges = (gameData: GameData, saved?: GameState): string[] => {
  const challenges = gameData.stages.reduce((total, stage) => total + stage.challenges.length, 0);
  return [
    ...sceneModes(gameData),
    CAMERA_BADGES[gameCameraRequirement(gameData) || "none"],
    `${count(gameData.stages.length, "stage")} · ${count(challenges, "challenge")}`,
    ...(isDefined(saved) ? [`${percentComplete(saved)}% complete`] : []),
    soundBadge(gameData),
  ];
};
