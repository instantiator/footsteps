import type { GameChallengeData } from "../data/GameChallengeData";
import type { GameChallengeAnswer } from "../data/GameChallengeSolution";
import type { GameChallengeDisplayPurpose } from "../data/displays/GameDisplayData";

export interface GameChallengeState {
  challenge: GameChallengeData;
  displayPurpose: GameChallengeDisplayPurpose | null;
  attempts: GameChallengeAnswer[];
  succeeded: boolean;
}
