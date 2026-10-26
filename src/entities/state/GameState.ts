import { GameOverviewPurposeSequence } from "../../components/core/logic/GameClickUtils";
import { isDefined } from "../../util/ObjectUtils";
import type { GameOverviewDisplayPurpose } from "../data/displays/GameDisplayData";
import type { GameData } from "../data/GameData";
import type { GameStageId } from "../data/GameStageData";
import type { GameStageState } from "./GameStageState";

/**
 * Identifies one display, and so its state: `overview:<purpose>`, `stage:<stageId>:shared`, or
 * `challenge:<stageId>:<challengeId>:<purpose>`.
 */
export type DisplayScope = string;

/** Runtime progress of a game: its definition, per-stage progress, what is currently showing, and display states. */
export interface GameState {
  /** The authored definition of the game being played. */
  gameData: GameData;
  /** Progress for each stage, in authored order. */
  stages: GameStageState[];
  /** What the player is currently looking at. */
  current: {
    /** The stage being played, or null while an overview is showing. */
    stageId: GameStageId | null;
    /** The overview display showing when no stage is active. */
    overviewDisplay: GameOverviewDisplayPurpose | null;
  };
  /** Each display's own state, by scope. A display with no entry uses its component's `initialState`. */
  displayStates: Record<DisplayScope, Record<string, unknown>>;
}

/**
 * Creates the starting state for a game: all challenges unsolved, and the first overview display showing.
 * With sequential config (the default) only the first stage is unlocked; otherwise all are.
 * @throws if the game has no overview display to start from
 */
export function createBlankGameState(game: GameData): GameState {
  const stages: GameStageState[] = game.stages.map((stage, index) => ({
    stage: stage,
    availability: (game.config?.sequential ?? true) ? (index === 0 ? "unlocked" : "locked") : "unlocked",
    completion: "ready",
    challengeStates: stage.challenges.map((challenge) => ({
      challenge: challenge,
      succeeded: false,
    })),
  }));

  const overviewDisplay = GameOverviewPurposeSequence.find((purpose) =>
    game.displays.some((d) => purpose === d.purpose),
  );
  if (!isDefined(overviewDisplay)) {
    throw new Error(`No initial overview display found, from: ${GameOverviewPurposeSequence.join(", ")}`);
  }

  return {
    gameData: game,
    stages: stages,
    current: {
      stageId: null,
      overviewDisplay,
    },
    displayStates: {},
  };
}
