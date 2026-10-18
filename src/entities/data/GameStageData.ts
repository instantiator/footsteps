import type { GameChallengeData } from "./GameChallengeData";
import type { GameStageDisplay } from "./displays/GameDisplayData";

export type GameStageId = string;

/**
 * Describes a game stage - including its displays, and the challenges it contains.
 * A stage may contain more than one challenge, and may group its challenges together.
 */
export interface GameStageData {
  /** Unique id for this stage */
  id: GameStageId;

  /**
   * Display information for the stage. (Optional.)
   */
  displays?: GameStageDisplay[];

  /** If set, group challenges together in the active layout, otherwise assumes a chunking of 1 */
  challengeChunking?: number;

  /** All challenges in a stage */
  challenges: GameChallengeData[];
}
