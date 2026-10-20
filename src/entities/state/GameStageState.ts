import type { GameStageData } from "../data/GameStageData";
import type { GameChallengeState } from "./GameChallengeState";

/** How far through a stage the player is: not started, some challenges solved, or all solved. */
export type GameStageCompletionState = "ready" | "partial" | "completed";

/** Whether the player may enter a stage yet. */
export type GameStageAvailabilityState = "locked" | "unlocked";

/** Runtime progress through one stage of a game. */
export interface GameStageState {
  /** The authored stage this state tracks. */
  stage: GameStageData;
  /** Progress through each challenge in the stage, in authored order. */
  challengeStates: GameChallengeState[];
  /** Whether the stage can be entered. */
  availability: GameStageAvailabilityState;
  /** How much of the stage is complete. */
  completion: GameStageCompletionState;
}
