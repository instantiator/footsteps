import type { GameChallengeData } from "../data/GameChallengeData";
import type { GameChallengeAnswer } from "../data/GameChallengeSolution";
import type { GameChallengeDisplayPurpose } from "../data/displays/GameDisplayData";

/** Runtime progress through one challenge. */
export interface GameChallengeState {
  /** The authored challenge this state tracks. */
  challenge: GameChallengeData;
  /**
   * Which of the challenge's displays is showing.
   * Not yet implemented: always null. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #5.
   */
  displayPurpose: GameChallengeDisplayPurpose | null;
  /**
   * Answers the player has submitted so far.
   * Not yet implemented: never updated. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #5.
   */
  attempts: GameChallengeAnswer[];
  /** Whether the player has solved the challenge. */
  succeeded: boolean;
}
