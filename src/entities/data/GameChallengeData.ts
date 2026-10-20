import type { GameChallengeSolution } from "./GameChallengeSolution";
import type { GameChallengeDisplay } from "./displays/GameDisplayData";

/** Unique identifier for a challenge within a stage. */
export type GameChallengeId = string;

/** Describes an individual challenge in the game */
export interface GameChallengeData {
  /** Unique id for this challenge, used when submitting and checking answers. */
  id: GameChallengeId;

  /** Displays for this challenge, chosen by purpose: title, in progress, and completed. */
  displays: GameChallengeDisplay[];

  /** How the player's answer is checked for this challenge. */
  solution: GameChallengeSolution;
}
