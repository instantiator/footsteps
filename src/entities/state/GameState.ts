import { GameOverviewPurposeSequence } from "../../components/core/logic/GameClickUtils";
import { isDefined } from "../../util/ObjectUtils";
import type { GameEffectAction, GameOverviewDisplayPurpose } from "../data/displays/GameDisplayData";
import type { GameData } from "../data/GameData";
import type { GameStageId } from "../data/GameStageData";
import type { GameStageState } from "./GameStageState";

/**
 * Identifies one display, and so its state: `overview:<purpose>`, `stage:<stageId>:shared`, or
 * `challenge:<stageId>:<challengeId>:<purpose>`. A display's reset display adds `/reset` to its scope.
 */
export type DisplayScope = string;

/** A sound or reward a rule asked for, waiting for the game to play it. */
export interface QueuedEffect {
  /** Identifies it, so it is played once however often the state is worked out; ids only grow. */
  id: number;
  /** What to play. */
  effect: GameEffectAction;
}

/** What lasts only while the game is open, and is never saved with its progress. */
export interface GameSession {
  /** The scopes of the reset displays finished since the game was loaded. */
  finishedResets: DisplayScope[];
  /** Sounds and rewards rules have asked for, until the game plays them. */
  effects: QueuedEffect[];
  /** The id the next queued effect gets. */
  nextEffectId: number;
}

/** A session with nothing in it, as a game starts or loads. */
export const newGameSession = (): GameSession => ({ finishedResets: [], effects: [], nextEffectId: 1 });

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
  /** What lasts only while the game is open. */
  session: GameSession;
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
    session: newGameSession(),
  };
}
