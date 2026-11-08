import { NO_PLAYERS, type PlayerCounts } from "../../components/camera/PlayerRegistry";
import { GameOverviewPurposeSequence } from "../../components/core/logic/GameClickUtils";
import { isDefined } from "../../util/ObjectUtils";
import type { RuleEvent } from "../../components/core/logic/GameRuleUtils";
import type { GameAction, GameFeedbackAction, GameOverviewScenePurpose } from "../data/scenes/GameSceneData";
import type { GameEffect } from "../data/scenes/GameEffectData";
import type { GameData } from "../data/GameData";
import type { GameStageId } from "../data/GameStageData";
import type { GameStageState } from "./GameStageState";

/**
 * Identifies one scene, and so its state: `overview:<purpose>`, `stage:<stageId>:shared`, or
 * `challenge:<stageId>:<challengeId>:<purpose>`. A scene's reset scene adds `/reset` to its scope.
 */
export type SceneScope = string;

/** A sound or reward a rule asked for, waiting for the game to play it. */
export interface QueuedEffect {
  /** Identifies it, so it is played once however often the state is worked out; ids only grow. */
  id: number;
  /** What to play. */
  effect: GameFeedbackAction;
  /** The scene whose rule asked for it. */
  scope: SceneScope;
  /** The event its rule fired with. */
  event: RuleEvent;
}

/** An action with a `delayMs`, waiting for the game to run it. Sounds and rewards are {@link QueuedEffect}s instead. */
export interface DelayedAction {
  /** Identifies it, as a {@link QueuedEffect}'s id does. */
  id: number;
  /** The scene whose rule it belongs to. */
  scope: SceneScope;
  /** Which run of the scene the rule fired in: the action is dropped if the scene has moved on from it. */
  run: number;
  /** What to do. */
  action: GameAction;
  /** What expressions see as `event`: the event the rule fired with. */
  event: RuleEvent;
  /** Where the action is in the game's rules, for error messages. */
  where: string;
}

/** An effect a rule has started, waiting for the game to play it. */
export interface QueuedVisualEffect {
  /** Identifies it, as a {@link QueuedEffect}'s id does. */
  id: number;
  /** The scene whose rule started it. */
  scope: SceneScope;
  /** Which run of the scene the rule fired in: it is dropped if the scene has moved on from it. */
  run: number;
  /** What to play. */
  effect: GameEffect;
  /** The event its rule fired with. */
  event: RuleEvent;
  /** Where the action is in the game's rules, for error messages. */
  where: string;
}

/** What lasts only while the game is open, and is never saved with its progress. */
export interface GameSession {
  /** The scopes of the reset scenes finished since the game was loaded. */
  finishedResets: SceneScope[];
  /** Sounds and rewards rules have asked for, until the game plays them. */
  effects: QueuedEffect[];
  /** Effects rules have started, until the game plays them. */
  visualEffects: QueuedVisualEffect[];
  /** Actions rules have delayed, until the game starts waiting for them. */
  delayedActions: DelayedAction[];
  /** How many players there are. Updated only as it changes, as an update re-renders the game. */
  players: PlayerCounts;
  /** The id the next queued effect or delayed action gets. */
  nextEffectId: number;
  /**
   * How many times each scene has started or ended: as it is shown, as it closes, and as it resets. What a scene starts
   * (its timers, template animations, delays and effects) belongs to one run, and ends with it.
   */
  sceneRuns: Record<SceneScope, number>;
}

/** A session with nothing in it, as a game starts or loads. */
export const newGameSession = (): GameSession => ({
  finishedResets: [],
  effects: [],
  visualEffects: [],
  delayedActions: [],
  players: NO_PLAYERS,
  nextEffectId: 1,
  sceneRuns: {},
});

/** Runtime progress of a game: its definition, per-stage progress, what is currently showing, and scene states. */
export interface GameState {
  /** The authored definition of the game being played. */
  gameData: GameData;
  /** Progress for each stage, in authored order. */
  stages: GameStageState[];
  /** What the player is currently looking at. */
  current: {
    /** The stage being played, or null while an overview is showing. */
    stageId: GameStageId | null;
    /** The overview scene showing when no stage is active. */
    overviewScene: GameOverviewScenePurpose | null;
  };
  /** Each scene's own state, by scope. A scene with no entry uses its component's `initialState`. */
  sceneStates: Record<SceneScope, Record<string, unknown>>;
  /** What lasts only while the game is open. */
  session: GameSession;
}

/**
 * Creates the starting state for a game: all challenges unsolved, and the first overview scene showing.
 * With sequential config (the default) only the first stage is unlocked; otherwise all are.
 * @throws if the game has no overview scene to start from
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

  const overviewScene = GameOverviewPurposeSequence.find((purpose) => game.scenes.some((d) => purpose === d.purpose));
  if (!isDefined(overviewScene)) {
    throw new Error(`No initial overview scene found, from: ${GameOverviewPurposeSequence.join(", ")}`);
  }

  return {
    gameData: game,
    stages: stages,
    current: {
      stageId: null,
      overviewScene,
    },
    sceneStates: {},
    session: newGameSession(),
  };
}
