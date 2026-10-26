import type { GameId } from "../data/GameData";
import type { GameState } from "./GameState";
import type { GameStageAvailabilityState, GameStageCompletionState } from "./GameStageState";

/**
 * A read-only view of a game's progress, for expressions and templates. It deliberately doesn't expose
 * `GameState`, so the internal shape can change without breaking games.
 */
export interface GameSnapshot {
  /** The game's id in the repository. */
  id: GameId;
  /** The game's title. */
  title: string;
  /** The settings that change how the game behaves. */
  config: {
    /** Whether each stage unlocks only after the previous one is completed. */
    sequential: boolean;
    /** Whether the game moves on to the next stage automatically. */
    autoAdvanceStages: boolean;
  };
  /** Each stage in order, with its progress. */
  stages: GameStageSummary[];
  /** What the player is looking at now. */
  current: {
    /** The open stage, or null while an overview shows. */
    stageId: string | null;
    /** The overview display showing when no stage is open. */
    overviewDisplay: string | null;
  };
}

/** One stage's progress. */
export interface GameStageSummary {
  /** The stage's id. */
  id: string;
  /** Whether the stage can be entered. */
  availability: GameStageAvailabilityState;
  /** How much of the stage is complete. */
  completion: GameStageCompletionState;
  /** Each challenge in the stage, in order. */
  challenges: GameChallengeSummary[];
}

/** One challenge's progress. */
export interface GameChallengeSummary {
  /** The challenge's id. */
  id: string;
  /** Whether the challenge has been solved. */
  succeeded: boolean;
}

/** Projects the game state into a snapshot. */
export const toGameSnapshot = (gameId: GameId, state: GameState): GameSnapshot => ({
  id: gameId,
  title: state.gameData.title,
  config: {
    sequential: state.gameData.config?.sequential ?? true,
    autoAdvanceStages: state.gameData.config?.autoAdvanceStages ?? false,
  },
  stages: state.stages.map((stage) => ({
    id: stage.stage.id,
    availability: stage.availability,
    completion: stage.completion,
    challenges: stage.challengeStates.map((c) => ({ id: c.challenge.id, succeeded: c.succeeded })),
  })),
  current: { ...state.current },
});
