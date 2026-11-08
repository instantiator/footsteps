import type { GameChallengeSolution } from "./GameChallengeSolution";
import type { GameChallengeScene } from "./scenes/GameSceneData";

/** Unique identifier for a challenge within a stage. */
export type GameChallengeId = string;

/** Describes an individual challenge in the game */
export interface GameChallengeData {
  /** Unique id for this challenge, used when submitting and checking answers. */
  id: GameChallengeId;

  /** Scenes for this challenge, chosen by purpose: title, in progress, and completed. */
  scenes: GameChallengeScene[];

  /** How the player's answer is checked for this challenge. */
  solution: GameChallengeSolution;
}
