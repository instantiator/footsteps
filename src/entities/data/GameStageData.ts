import type { GameChallengeData } from "./GameChallengeData";
import type { GameStageScene } from "./scenes/GameSceneData";

/** Unique identifier for a stage within a game. */
export type GameStageId = string;

/**
 * Describes a game stage - including its scenes, and the challenges it contains.
 * A stage may contain more than one challenge, and may group its challenges together.
 */
export interface GameStageData {
  /** Unique id for this stage, referenced by `enterStage` actions in scene rules. */
  id: GameStageId;

  /** Scenes shown behind this stage's challenges (purpose `shared`). Optional. */
  scenes?: GameStageScene[];

  /** How many challenges to show together at once in the stage layout. Default: 1. */
  challengeChunking?: number;

  /** The challenges in this stage, in the order they are presented. */
  challenges: GameChallengeData[];
}
