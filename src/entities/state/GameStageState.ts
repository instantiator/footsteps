import type { GameStageData } from "../data/GameStageData";
import type { GameChallengeState } from "./GameChallengeState";

export type GameStageCompletionState = "ready" | "partial" | "completed";
export type GameStageAvailabilityState = "locked" | "unlocked";

export interface GameStageState {
  stage: GameStageData;
  challengeStates: GameChallengeState[];
  availability: GameStageAvailabilityState;
  completion: GameStageCompletionState;
}
