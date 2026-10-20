import type { GameChallengeData } from "../data/GameChallengeData";

/** Runtime progress through one challenge. */
export interface GameChallengeState {
  /** The authored challenge this state tracks. */
  challenge: GameChallengeData;
  /** Whether the player has solved the challenge. */
  succeeded: boolean;
}
