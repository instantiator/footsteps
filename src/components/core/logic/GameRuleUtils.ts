import _ from "lodash";
import type { GameId } from "../../../entities/data/GameData";
import type { GameEffect } from "../../../entities/data/scenes/GameEffectData";
import type {
  GameAction,
  GameFeedbackAction,
  GameFinishResetAction,
  GameInteraction,
  GameInteractTrigger,
  PointerInteraction,
  GameTrigger,
} from "../../../entities/data/scenes/GameSceneData";
import { toGameSnapshot } from "../../../entities/state/GameSnapshot";
import type { DelayedAction, SceneScope, GameState } from "../../../entities/state/GameState";
import { enterStage } from "./GameClickUtils";
import {
  compileGameExpression,
  evaluateGameExpression,
  type ExpressionContext,
  type GameExpression,
} from "./GameExpressionUtils";
import { findChallengeState } from "./GameDataUtils";
import {
  completeChallenge,
  sceneRun,
  forgetFinishedResets,
  resetChallenge,
  startSceneRuns,
  validateAnswer,
} from "./GameStateUtils";
import { getSceneSlots, getSceneState, getShownScenes, type ShownScene } from "./RenderDataUtils";
import { matchTarget, type SceneDomEvent } from "./TemplateUtils";
import { isDefined } from "../../../util/ObjectUtils";

/** Every expression in a game's rules, compiled once when the game loads, by source text. */
export type GameExpressions = ReadonlyMap<string, GameExpression>;

/** Whether an interaction is one of entering an element, which can be held: `mouse-enter`, or a camera `-enter`. */
export const isEntering = (interaction: GameInteraction): boolean => interaction.endsWith("-enter");

/** Shows again the reset scenes set to show before every showing, of the scenes the game has just started showing. */
const showEveryShowResets = (previous: GameState | undefined, next: GameState): GameState => {
  const wasSlot = new Set(isDefined(previous) ? getSceneSlots(previous).map((slot) => slot.scope) : []);
  const showAgain = getSceneSlots(next)
    .filter(({ scope, scene }) => scene.resetScene?.showOn === "every-show" && !wasSlot.has(scope))
    .map(({ scope }) => scope);
  return showAgain.length > 0 ? forgetFinishedResets(next, showAgain) : next;
};

/**
 * Prepares scenes as they are shown. It runs on every game state change, in the same update, so a scene never
 * renders its old state:
 * - a scene whose reset scene shows before every showing shows it again;
 * - a reset scene, or a scene with `resetStateOnShow`, returns to its `initialState`;
 * - each starts a new run, and so does each it has just stopped showing, which ends what it started. (The overview
 *   still renders behind a stage, so nothing else would end its effects.)
 * @param previous the state before the change, or undefined when the game starts
 */
export const applyShowResets = (previous: GameState | undefined, next: GameState): GameState => {
  const prepared = showEveryShowResets(previous, next);
  const wasShown = new Set(isDefined(previous) ? getShownScenes(previous).map((d) => d.scope) : []);
  const shown = getShownScenes(prepared);
  const shownNow = shown.filter((d) => !wasShown.has(d.scope));
  const stillShown = new Set(shown.map((d) => d.scope));
  const closed = Array.from(wasShown).filter((scope) => !stillShown.has(scope));
  if (shownNow.length === 0 && closed.length === 0) return prepared;
  const sceneStates = { ...prepared.sceneStates };
  for (const { scope, isReset, component } of shownNow) {
    if (isReset === true || component.resetStateOnShow === true) delete sceneStates[scope];
  }
  return startSceneRuns({ ...prepared, sceneStates }, [...shownNow.map((d) => d.scope), ...closed]);
};

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

/** Most `when` rounds that may fire in a row before the chain counts as a loop and is stopped. */
export const MAX_WHEN_CHAIN = 10;

/** One rule firing: the environment, the scene it belongs to, and the event it fired with. */
interface RuleRun {
  /** The game's id and compiled expressions. */
  env: RuleEnvironment;
  /** The scene whose rule it is. */
  scene: ShownScene;
  /** What expressions see as `event`. */
  event: RuleEvent;
}

/** Evaluates an expression source for a scene, compiling it if it wasn't compiled at load (eg. in tests). */
const evaluate = ({ env, scene, event }: RuleRun, state: GameState, source: string, where: string): unknown => {
  const context: ExpressionContext = {
    state: getSceneState(state, scene.scope, scene.component),
    data: scene.component.data,
    game: toGameSnapshot(env.gameId, state),
    event,
  };
  return evaluateGameExpression(env.expressions.get(source) ?? compileGameExpression(source, where), context, where);
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

/** Adds a sound or reward to those waiting for the game to play them. */
const queueEffect = ({ scene, event }: RuleRun, state: GameState, effect: GameFeedbackAction): GameState => {
  const { effects, nextEffectId } = state.session;
  const queued = { id: nextEffectId, effect, scope: scene.scope, event };
  return { ...state, session: { ...state.session, effects: [...effects, queued], nextEffectId: nextEffectId + 1 } };
};

/** Marks a reset scene finished, revealing what it was shown for. */
const finishReset = (state: GameState, scope: SceneScope): GameState =>
  state.session.finishedResets.includes(scope)
    ? state
    : { ...state, session: { ...state.session, finishedResets: [...state.session.finishedResets, scope] } };

/** Adds an effect to those waiting for the game to play them. */
const queueVisualEffect = (
  { scene, event }: RuleRun,
  state: GameState,
  effect: GameEffect,
  where: string,
): GameState => {
  const { visualEffects, nextEffectId } = state.session;
  const queued = {
    id: nextEffectId,
    scope: scene.scope,
    run: sceneRun(state, scene.scope),
    effect,
    event,
    where,
  };
  return {
    ...state,
    session: { ...state.session, visualEffects: [...visualEffects, queued], nextEffectId: nextEffectId + 1 },
  };
};

/** Puts an action off, for the game to run after its `delayMs`. */
const delayAction = ({ scene, event }: RuleRun, state: GameState, action: GameAction, where: string): GameState => {
  const { delayedActions, nextEffectId } = state.session;
  const delayed = {
    id: nextEffectId,
    scope: scene.scope,
    run: sceneRun(state, scene.scope),
    action,
    event,
    where,
  };
  return {
    ...state,
    session: { ...state.session, delayedActions: [...delayedActions, delayed], nextEffectId: nextEffectId + 1 },
  };
};

/** Applies one action, to the game or (for finishing a reset scene, and sounds and rewards) to the session. */
const applyAction = (run: RuleRun, state: GameState, action: GameAction, where: string): GameState => {
  if ("finishReset" in action) return finishReset(state, run.scene.scope);
  if ("sound" in action || "reward" in action) return queueEffect(run, state, action);
  if ("effect" in action) return queueVisualEffect(run, state, action, where);
  return applyGameAction(run, state, action, where);
};

/** Applies one action to the game. Challenge actions are only on challenge scenes, as checked when the game loads. */
const applyGameAction = (
  run: RuleRun,
  state: GameState,
  action: Exclude<GameAction, GameFinishResetAction | GameFeedbackAction | GameEffect>,
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

/** Applies one rule of a scene: checks its `if`, then applies its actions in order. */
const applyRule = (run: RuleRun, state: GameState, ruleIndex: number): GameState => {
  const rule = run.scene.component.rules![ruleIndex];
  const where = `${run.scene.scope} › rules[${ruleIndex}]`;
  if (isDefined(rule.if) && !evaluate(run, state, rule.if, `${where}.if`)) return state;
  return rule.do.reduce((current, action, a) => {
    const actionWhere = `${where}.do[${a}]`;
    const delayed = (action.delayMs ?? 0) > 0 && !("sound" in action || "reward" in action);
    return (delayed ? delayAction : applyAction)(run, current, action, actionWhere);
  }, state);
};

/**
 * Runs an action whose delay is over, against the latest state. Its rule's `if` isn't checked again.
 * @returns the state, unchanged, if its scene has closed or reset since the rule fired
 */
export const applyDelayedAction = (
  env: RuleEnvironment,
  state: GameState,
  { scope, run, action, event, where }: DelayedAction,
): GameState => {
  const scene = getShownScenes(state).find((d) => d.scope === scope);
  if (!isDefined(scene) || sceneRun(state, scope) !== run) return state;
  return applyAction({ env, scene, event }, state, action, where);
};

/**
 * Fires the rules of one shown scene that `pick` chooses, in order.
 * @param pick the event a rule fires with, or undefined if its trigger doesn't match
 * @returns the new state; the given state, unchanged, if the scene isn't shown or no rule changed anything
 */
export const fireRules = (
  env: RuleEnvironment,
  state: GameState,
  scope: SceneScope,
  pick: (trigger: GameTrigger, ruleIndex: number) => RuleEvent | undefined,
): GameState => {
  const scene = getShownScenes(state).find((d) => d.scope === scope);
  if (!isDefined(scene)) return state;
  return (scene.component.rules ?? []).reduce((current, rule, ruleIndex) => {
    const event = pick(rule.on, ruleIndex);
    return isDefined(event) ? applyRule({ env, scene, event }, current, ruleIndex) : current;
  }, state);
};

/** The key of a `when` rule in {@link WhenEdges}, for one run of its scene, so a reset begins the rule again. */
export const whenKey = (state: GameState, scope: SceneScope, ruleIndex: number): string =>
  `${scope}#${sceneRun(state, scope)}#${ruleIndex}`;

/** Each `when` rule's last value, keyed by {@link whenKey}, for spotting false-to-true changes. */
export type WhenEdges = ReadonlyMap<string, boolean>;

/** The outcome of one round of `when` rules. */
export interface WhenRound {
  /** The state after the rules that fired. */
  state: GameState;
  /** Each shown `when` rule's value in the state the round started from. */
  edges: WhenEdges;
  /** The keys of the rules that fired. */
  fired: string[];
}

/**
 * Evaluates the `when` rules of the shown scenes against one state, then fires those that changed from false to
 * true, in order. A rule seen for the first time (its scene has just been shown) only records its value.
 * @param fire false to only record values
 */
const whenRound = (env: RuleEnvironment, state: GameState, edges: WhenEdges, fire = true): WhenRound => {
  const values = new Map<string, boolean>();
  const firing: [ShownScene, number, string][] = [];
  for (const scene of getShownScenes(state)) {
    (scene.component.rules ?? []).forEach((rule, ruleIndex) => {
      if (!("when" in rule.on)) return;
      const key = whenKey(state, scene.scope, ruleIndex);
      const where = `${scene.scope} › rules[${ruleIndex}].on.when`;
      const value = Boolean(evaluate({ env, scene, event: NO_EVENT }, state, rule.on.when, where));
      // A rule held for a while is fired by the game's timers, once it has stayed true
      const immediate = !isDefined(rule.on.forMs);
      if (fire && immediate && edges.get(key) === false && value) firing.push([scene, ruleIndex, key]);
      values.set(key, value);
    });
  }
  const next = firing.reduce(
    (current, [scene, ruleIndex]) => applyRule({ env, scene, event: NO_EVENT }, current, ruleIndex),
    state,
  );
  return { state: next, edges: values, fired: firing.map(([, , key]) => key) };
};

/**
 * Runs `when` rules after a change until none fire. A `set` can make another `when` fire, so a chain longer than
 * {@link MAX_WHEN_CHAIN} rounds is logged, naming the rules still firing, and stopped. Its values are then recorded
 * against the final state, so the loop doesn't restart on the next change.
 */
export const runWhens = (env: RuleEnvironment, state: GameState, edges: WhenEdges): Omit<WhenRound, "fired"> => {
  let round: WhenRound = { state, edges, fired: [] };
  for (let step = 0; step < MAX_WHEN_CHAIN; step++) {
    round = whenRound(env, round.state, round.edges);
    if (round.fired.length === 0) return round;
  }
  console.error(`when rules still firing after ${MAX_WHEN_CHAIN} rounds, so stopped: ${round.fired.join(", ")}`);
  return { state: round.state, edges: whenRound(env, round.state, round.edges, false).edges };
};

/** The interactions an interact trigger accepts, as a list. */
export const triggerInteractions = (trigger: GameInteractTrigger): GameInteraction[] =>
  Array.isArray(trigger.interact) ? trigger.interact : [trigger.interact];

/** The pointer interaction each kind of DOM event is. */
const POINTER_EVENT_INTERACTIONS: Partial<Record<SceneDomEvent["kind"], PointerInteraction>> = {
  click: "click",
  mouseOver: "mouse-enter",
  mouseOut: "mouse-exit",
};

/**
 * The element a pointer event fires an interact trigger for: one matching its selector that the click happened in,
 * or that the mouse entered or left. Moving between an element's own children neither enters nor leaves it.
 */
const pointerTarget = (trigger: GameInteractTrigger, event: SceneDomEvent, interaction: PointerInteraction) => {
  if (!triggerInteractions(trigger).includes(interaction)) return undefined;
  const element = isDefined(trigger.target) ? matchTarget(event, trigger.target) : undefined;
  return isDefined(element) && isDefined(event.related) && element.contains(event.related) ? undefined : element;
};

/** Whether a trigger names this animation or transition end. */
const namesEvent = (trigger: GameTrigger, event: SceneDomEvent): boolean =>
  (event.kind === "animationEnd" && "animationEnd" in trigger && trigger.animationEnd === event.name) ||
  (event.kind === "transitionEnd" && "transitionEnd" in trigger && trigger.transitionEnd === event.name);

/**
 * Whether a DOM event inside a scene fires a rule's trigger: a click on, or the mouse entering or leaving, an
 * element matching an interact trigger that accepts it, or the end of the named animation or transition on a
 * matching element.
 * @returns the event the rule fires with, or undefined if it doesn't fire
 */
export const matchSceneEvent = (trigger: GameTrigger, event: SceneDomEvent): RuleEvent | undefined => {
  const interaction = POINTER_EVENT_INTERACTIONS[event.kind];
  if (isDefined(interaction)) {
    const element = "interact" in trigger ? pointerTarget(trigger, event, interaction) : undefined;
    return isDefined(element) ? { id: element.id, interaction, player: 0 } : undefined;
  }
  const selector = namesEvent(trigger, event) && "target" in trigger ? trigger.target : undefined;
  const element = isDefined(selector) ? matchTarget(event, selector) : undefined;
  return isDefined(element) ? { id: element.id, interaction: "", player: 0 } : undefined;
};

/** The shortest gap between `every` firings, so a tiny or zero interval can't flood the game with updates. */
export const MIN_EVERY_MS = 50;

/**
 * How long an `every` or `after` rule waits, worked out now: a number, or an expression over the scene's state.
 * @returns milliseconds, or undefined (after logging) if the value isn't a usable number
 */
export const ruleDelay = (
  env: RuleEnvironment,
  state: GameState,
  scene: ShownScene,
  ruleIndex: number,
): number | undefined => {
  const trigger = scene.component.rules![ruleIndex].on;
  const value = "every" in trigger ? trigger.every : "after" in trigger ? trigger.after : undefined;
  const where = `${scene.scope} › rules[${ruleIndex}].on`;
  const ms = typeof value === "string" ? evaluate({ env, scene, event: NO_EVENT }, state, value, where) : value;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    console.error(`${where}: a duration must be a number of milliseconds, not ${String(ms)}`);
    return undefined;
  }
  return "every" in trigger ? Math.max(ms, MIN_EVERY_MS) : ms;
};
