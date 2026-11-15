import _ from "lodash";
import type { GameId } from "../../../entities/data/GameData";
import type { GameEffect, ResolvedEffect } from "../../../entities/data/scenes/GameEffectData";
import type {
  GameAction,
  GameFeedbackAction,
  GameFinishResetAction,
  GameParallelAction,
  GameRaiseAction,
  GameSeriesAction,
  GameTime,
} from "../../../entities/data/scenes/GameSceneData";
import { toGameSnapshot } from "../../../entities/state/GameSnapshot";
import type {
  DelayedAction,
  GameState,
  QueuedEffect,
  QueuedVisualEffect,
  SceneScope,
} from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { enterStage } from "./GameClickUtils";
import { findChallengeState } from "./GameDataUtils";
import {
  compileGameExpression,
  evaluateGameExpression,
  type ExpressionContext,
  type GameExpression,
} from "./GameExpressionUtils";
import { completeChallenge, resetChallenge, sceneRun, startSceneRuns, validateAnswer } from "./GameStateUtils";
import { getSceneState, type ShownScene } from "./RenderDataUtils";

/** Every expression in a game's rules, compiled once when the game loads, by source text. */
export type GameExpressions = ReadonlyMap<string, GameExpression>;

/** What rules need besides the game state: the game's id (for the snapshot) and its compiled expressions. */
export interface RuleEnvironment {
  /** The game's id in the repository. */
  gameId: GameId;
  /** The game's compiled expressions, by source. */
  expressions: GameExpressions;
}

/** The element an element trigger matched, as expressions see it in `event`. */
export type RuleEvent = ExpressionContext["event"];

/** The `event` for triggers that don't concern an element. */
export const NO_EVENT: RuleEvent = { id: "", interaction: "", player: 0 };

/** One rule firing: the environment, the scene it belongs to, and the event it fired with. */
export interface RuleRun {
  /** The game's id and compiled expressions. */
  env: RuleEnvironment;
  /** The scene whose rule it is. */
  scene: ShownScene;
  /** What expressions see as `event`. */
  event: RuleEvent;
}

/** The target that means the element the rule fired for, by its `event.id`. */
export const EVENT_TARGET = "event";

/** Evaluates an expression source for a scene, compiling it if it wasn't compiled at load (eg. in tests). */
export const evaluate = ({ env, scene, event }: RuleRun, state: GameState, source: string, where: string): unknown => {
  const context: ExpressionContext = {
    state: getSceneState(state, scene.scope, scene.component),
    data: scene.component.data,
    game: toGameSnapshot(env.gameId, state),
    event,
  };
  return evaluateGameExpression(env.expressions.get(source) ?? compileGameExpression(source, where), context, where);
};

/**
 * A time worked out now: a number, or an expression over the rule's scene.
 * @returns milliseconds, or undefined (after logging, naming `where`) if it isn't a finite number of at least 0
 */
export const timeOf = (run: RuleRun, state: GameState, value: GameTime, where: string): number | undefined => {
  const ms = typeof value === "string" ? evaluate(run, state, value, where) : value;
  if (typeof ms === "number" && Number.isFinite(ms) && ms >= 0) return ms;
  console.error(`${where}: a duration must be a number of milliseconds, not ${String(ms)}`);
  return undefined;
};

/**
 * A target with {@link EVENT_TARGET} made into a selector for the element the rule fired for.
 * @returns the target, or undefined (after logging, naming `where`) if it means the event's element and there is none
 */
export const resolveEventTarget = <T extends string | undefined>(
  target: T,
  event: RuleEvent,
  where: string,
): T | string | undefined => {
  if (target !== EVENT_TARGET) return target;
  if (event.id !== "") return `[id="${event.id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
  console.error(`${where}.target: "event" needs an element with an id to have fired the rule`);
  return undefined;
};

/** An effect with its target worked out for the rule's event; undefined (after logging) if it can't be. */
const withEventTarget = (run: RuleRun, effect: ResolvedEffect, where: string): ResolvedEffect | undefined => {
  if (!("target" in effect) || effect.target !== EVENT_TARGET) return effect;
  const target = resolveEventTarget(effect.target, run.event, where);
  return isDefined(target) ? { ...effect, target } : undefined;
};

/** An effect with its times and target worked out now; undefined (after logging) if one can't be. */
const resolveEffect = (
  run: RuleRun,
  state: GameState,
  effect: GameEffect,
  where: string,
): ResolvedEffect | undefined => {
  const { durationMs, cycleMs } = { durationMs: undefined, cycleMs: undefined, ...effect };
  const duration =
    durationMs === undefined || durationMs === "indefinite"
      ? durationMs
      : timeOf(run, state, durationMs, `${where}.durationMs`);
  const cycle = cycleMs === undefined ? undefined : timeOf(run, state, cycleMs, `${where}.cycleMs`);
  if ((isDefined(durationMs) && !isDefined(duration)) || (isDefined(cycleMs) && !isDefined(cycle))) return undefined;
  return withEventTarget(run, { ...effect, durationMs: duration, cycleMs: cycle }, where);
};

/** Sets the scene's state keys to their expressions' values, all worked out from the state before the action. */
const applySet = (run: RuleRun, state: GameState, values: Record<string, string>, where: string): GameState => {
  const updates = _.omitBy(
    _.mapValues(values, (source, key) => evaluate(run, state, source, `${where}.set.${key}`)),
    _.isUndefined,
  );
  const { scope, component } = run.scene;
  return {
    ...state,
    sceneStates: { ...state.sceneStates, [scope]: { ...getSceneState(state, scope, component), ...updates } },
  };
};

/** Submits an answer to the scene's challenge; a correct one completes it, as a typed answer does. */
const applyAnswer = (state: GameState, { stageId, challengeId }: ShownScene, answer: unknown): GameState => {
  const challengeState = findChallengeState(state, stageId!, challengeId!);
  if (challengeState.succeeded || validateAnswer(challengeState.challenge, String(answer)) !== true) return state;
  return completeChallenge(state, stageId!, challengeId!);
};

/**
 * Adds a sound or reward to those waiting for the game to play them, after its delay.
 * @param timing its delay, and the running action that ends when it has played, if any
 */
export const queueEffect = (
  { scene, event }: RuleRun,
  state: GameState,
  effect: GameFeedbackAction,
  { delayMs, actionId }: Pick<QueuedEffect, "delayMs" | "actionId">,
): GameState => {
  const { effects, nextEffectId } = state.session;
  const queued = { id: nextEffectId, effect, delayMs, scope: scene.scope, event, actionId };
  return { ...state, session: { ...state.session, effects: [...effects, queued], nextEffectId: nextEffectId + 1 } };
};

/** Marks a reset scene finished, revealing what it was shown for. */
const finishReset = (state: GameState, scope: SceneScope): GameState =>
  state.session.finishedResets.includes(scope)
    ? state
    : { ...state, session: { ...state.session, finishedResets: [...state.session.finishedResets, scope] } };

/**
 * Adds an effect, with its times and target worked out now, to those waiting for the game to play them.
 * @param at where the action is in the rules, and the running action that ends with it, if any
 * @returns undefined (after logging) if it can't be worked out
 */
export const queueVisualEffect = (
  run: RuleRun,
  state: GameState,
  effect: GameEffect,
  { where, actionId }: Pick<QueuedVisualEffect, "where" | "actionId">,
): GameState | undefined => {
  const resolved = resolveEffect(run, state, effect, where);
  if (!isDefined(resolved)) return undefined;
  const { scene, event } = run;
  const { visualEffects, nextEffectId } = state.session;
  const queued = {
    id: nextEffectId,
    scope: scene.scope,
    run: sceneRun(state, scene.scope),
    effect: resolved,
    event,
    where,
    actionId,
  };
  return {
    ...state,
    session: { ...state.session, visualEffects: [...visualEffects, queued], nextEffectId: nextEffectId + 1 },
  };
};

/** Puts an action off, for the game to run after its delay. */
export const delayAction = (
  { scene, event }: RuleRun,
  state: GameState,
  waiting: Pick<DelayedAction, "action" | "where" | "delayMs" | "actionId">,
): GameState => {
  const { delayedActions, nextEffectId } = state.session;
  const delayed = { id: nextEffectId, scope: scene.scope, run: sceneRun(state, scene.scope), event, ...waiting };
  return {
    ...state,
    session: { ...state.session, delayedActions: [...delayedActions, delayed], nextEffectId: nextEffectId + 1 },
  };
};

/** A series or parallel group of actions. */
export type GameGroupAction = GameSeriesAction | GameParallelAction;

/** Whether an action is a group of others. */
export const isGroup = (action: GameAction): action is GameGroupAction => "series" in action || "parallel" in action;

/** The actions {@link applyAction} applies at once: all but sounds, rewards, effects, raised events and groups. */
export type ImmediateAction = Exclude<GameAction, GameFeedbackAction | GameEffect | GameRaiseAction | GameGroupAction>;

/** Applies one action that happens at once, to the game or (for finishing a reset scene) to the session. */
export const applyAction = (run: RuleRun, state: GameState, action: ImmediateAction, where: string): GameState => {
  if ("finishReset" in action) return finishReset(state, run.scene.scope);
  return applyGameAction(run, state, action, where);
};

/** Applies one action to the game. Challenge actions are only on challenge scenes, as checked when the game loads. */
const applyGameAction = (
  run: RuleRun,
  state: GameState,
  action: Exclude<ImmediateAction, GameFinishResetAction>,
  where: string,
): GameState => {
  const { scope, stageId, challengeId } = run.scene;
  if ("set" in action) return applySet(run, state, action.set, where);
  if ("resetState" in action) {
    return startSceneRuns({ ...state, sceneStates: _.omit(state.sceneStates, scope) }, [scope]);
  }
  if ("answer" in action) return applyAnswer(state, run.scene, evaluate(run, state, action.answer, `${where}.answer`));
  if ("completeChallenge" in action) {
    const done = findChallengeState(state, stageId!, challengeId!).succeeded;
    return done ? state : completeChallenge(state, stageId!, challengeId!);
  }
  if ("resetChallenge" in action) return resetChallenge(state, stageId!, challengeId!);
  return enterStage(state, action.enterStage) ?? state;
};
