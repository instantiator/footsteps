import _ from "lodash";
import type { GameAction, GameTrigger } from "../../../entities/data/scenes/GameSceneData";
import type { DelayedAction, GameState, RunningAction, SceneScope } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { sceneRun } from "./GameStateUtils";
import { getShownScenes } from "./RenderDataUtils";
import {
  applyAction,
  delayAction,
  evaluate,
  isGroup,
  queueEffect,
  queueVisualEffect,
  timeOf,
  type GameGroupAction,
  type RuleEnvironment,
  type RuleEvent,
  type RuleRun,
} from "./RuleActions";

/** Chooses the rules that fire, and the event each fires with; undefined for a rule that doesn't. */
export type RulePick = (trigger: GameTrigger, ruleIndex: number) => RuleEvent | undefined;

/** Most named starts, ends and raised events that may set each other off in one update, before it counts as a loop. */
export const MAX_EVENT_CHAIN = 10;

/**
 * How deep the named starts, ends and raised events now firing have set each other off.
 * ponytail: module state, as rules apply synchronously; thread it through if they ever don't.
 */
let chainDepth = 0;

/** The element an action ended with: its id for `event`, and a check of `actionEnd` targets against it. */
export interface EndedWith {
  /** The element's id. */
  id: string;
  /** Whether the element matches a selector. */
  matches: (selector: string) => boolean;
}

/**
 * Fires a pick in every shown scene, as named starts and ends and raised events reach them all. A chain deeper than
 * {@link MAX_EVENT_CHAIN} is logged, naming where it was stopped, and goes no further.
 */
const fireEverywhere = (env: RuleEnvironment, state: GameState, pick: RulePick, where: string): GameState => {
  if (chainDepth >= MAX_EVENT_CHAIN) {
    console.error(`${where}: stopped, as named actions and raised events set each other off ${MAX_EVENT_CHAIN} deep`);
    return state;
  }
  chainDepth++;
  try {
    return getShownScenes(state).reduce((current, { scope }) => fireRules(env, current, scope, pick), state);
  } finally {
    chainDepth--;
  }
};

/** The rules a named action starting fires. */
const startPick =
  (name: string, event: RuleEvent): RulePick =>
  (trigger) =>
    "actionStart" in trigger && trigger.actionStart === name ? event : undefined;

/** The rules a named action ending fires: those naming it, whose target (if any) the element it ended with matches. */
const endPick =
  (name: string, event: RuleEvent, ended: EndedWith | undefined): RulePick =>
  (trigger) => {
    if (!("actionEnd" in trigger) || trigger.actionEnd !== name) return undefined;
    if (isDefined(trigger.target) && ended?.matches(trigger.target) !== true) return undefined;
    return isDefined(ended) ? { ...event, id: ended.id } : event;
  };

/** The rules a raised event fires. */
const raisedPick =
  (name: string, event: RuleEvent): RulePick =>
  (trigger) =>
    "raised" in trigger && trigger.raised === name ? event : undefined;

/**
 * Starts what an action does, now.
 * @param actionId the running action it is, if something waits on it
 * @returns the state, and whether the action has already ended: it happens at once, or couldn't happen (logged)
 */
const play = (
  run: RuleRun,
  state: GameState,
  action: Exclude<GameAction, GameGroupAction>,
  { where, actionId }: { where: string; actionId?: number },
): [GameState, boolean] => {
  if ("sound" in action || "reward" in action)
    return [queueEffect(run, state, action, { delayMs: 0, actionId }), false];
  if ("effect" in action) {
    const queued = queueVisualEffect(run, state, action, { where, actionId });
    return isDefined(queued) ? [queued, false] : [state, true];
  }
  if ("raise" in action) return [fireEverywhere(run.env, state, raisedPick(action.raise, run.event), where), true];
  return [applyAction(run, state, action, where), true];
};

/** Whether something waits on an action ending, so it needs a record while it runs. (A group waits on its own.) */
const isWaitedOn = (action: GameAction, parent: number | undefined): boolean =>
  isDefined(parent) || isDefined(action.name);

/** The state with a running action recorded. */
const withRunning = (state: GameState, record: RunningAction): GameState => ({
  ...state,
  session: {
    ...state.session,
    runningActions: { ...state.session.runningActions, [record.id]: record },
    nextEffectId: Math.max(state.session.nextEffectId, record.id + 1),
  },
});

/** Starts an action nothing waits on, as a plain `do` list's actions are: after its delay, if it has one. */
const startUnwatched = (
  run: RuleRun,
  state: GameState,
  action: Exclude<GameAction, GameGroupAction>,
  where: string,
): GameState => {
  const delayMs = timeOf(run, state, action.delayMs ?? 0, `${where}.delayMs`);
  if (!isDefined(delayMs)) return state;
  // Sounds and rewards wait in the game's own queue, so they carry on if their scene closes
  if ("sound" in action || "reward" in action) return queueEffect(run, state, action, { delayMs });
  if (delayMs > 0) return delayAction(run, state, { action, where, delayMs });
  return play(run, state, action, { where })[0];
};

/**
 * Starts an action: after its `delayMs`, if it has one. One that is named, or in a group, is recorded while it runs,
 * so it can report its end; one whose delay can't be worked out (logged) ends at once.
 * @param parent the group it is in, if any
 */
export const startAction = (
  run: RuleRun,
  state: GameState,
  action: GameAction,
  { where, parent }: { where: string; parent?: number },
): GameState => {
  if (!isGroup(action) && !isWaitedOn(action, parent)) return startUnwatched(run, state, action, where);
  const id = state.session.nextEffectId;
  const scope = run.scene.scope;
  const record = { id, scope, run: sceneRun(state, scope), action, event: run.event, where, parent };
  const recorded = withRunning(state, record);
  const delayMs = timeOf(run, recorded, action.delayMs ?? 0, `${where}.delayMs`);
  if (!isDefined(delayMs)) return endAction(run.env, recorded, id);
  if (delayMs > 0) return delayAction(run, recorded, { action, where, delayMs, actionId: id });
  return beginAction(run, recorded, id);
};

/** A recorded action's wait is over: its name's `actionStart` rules fire, and it starts. */
const beginAction = (run: RuleRun, state: GameState, id: number): GameState => {
  const record = state.session.runningActions[id];
  if (!isDefined(record)) return state;
  const { action, where } = record;
  const started = isDefined(action.name)
    ? fireEverywhere(run.env, state, startPick(action.name, record.event), where)
    : state;
  if (isGroup(action)) return beginGroup(run, started, id);
  const [next, ended] = play(run, started, action, { where, actionId: id });
  return ended ? endAction(run.env, next, id) : next;
};

/** A group's actions, and how to name where each is. */
const groupParts = (action: GameGroupAction): { actions: GameAction[]; key: "series" | "parallel" } =>
  "series" in action ? { actions: action.series, key: "series" } : { actions: action.parallel, key: "parallel" };

/** The state with a running group's progress updated. */
const withProgress = (state: GameState, id: number, progress: number): GameState => {
  const record = state.session.runningActions[id];
  return isDefined(record) ? withRunning(state, { ...record, progress }) : state;
};

/** Starts one of a running group's actions. */
const startPart = (
  run: RuleRun,
  state: GameState,
  { record, parts: { actions, key } }: { record: RunningAction; parts: ReturnType<typeof groupParts> },
  index: number,
): GameState =>
  startAction(run, state, actions[index], { where: `${record.where}.${key}[${index}]`, parent: record.id });

/**
 * Starts a group: a series its first action, a parallel group all of them. One with no actions ends at once. Progress
 * is recorded first, as an action may end as it starts.
 */
const beginGroup = (run: RuleRun, state: GameState, id: number): GameState => {
  const record = state.session.runningActions[id];
  if (!isDefined(record) || !isGroup(record.action)) return state;
  const parts = groupParts(record.action);
  if (parts.actions.length === 0) return endAction(run.env, state, id);
  if (parts.key === "series") return startPart(run, withProgress(state, id, 0), { record, parts }, 0);
  return parts.actions.reduce(
    (current, _action, index) => startPart(run, current, { record, parts }, index),
    withProgress(state, id, parts.actions.length),
  );
};

/** One of a group's actions has ended: a series starts its next, and a group with nothing left ends. */
const partEnded = (env: RuleEnvironment, state: GameState, id: number): GameState => {
  const record = state.session.runningActions[id];
  const scene = getShownScenes(state).find(({ scope }) => scope === record?.scope);
  if (!isDefined(record) || !isDefined(scene) || !isGroup(record.action)) return state;
  const parts = groupParts(record.action);
  const progress = record.progress ?? 0;
  if (parts.key === "parallel") {
    return progress <= 1 ? endAction(env, state, id) : withProgress(state, id, progress - 1);
  }
  if (progress + 1 >= parts.actions.length) return endAction(env, state, id);
  const run = { env, scene, event: record.event };
  return startPart(run, withProgress(state, id, progress + 1), { record, parts }, progress + 1);
};

/**
 * A running action has ended: its record goes, its name's `actionEnd` rules fire, and its group (if any) moves on.
 * An action whose scene has closed or reset since it started is dropped without ending.
 * @param ended the element it ended with, if it ended on one (a spawned copy, or an effect's element)
 */
export const endAction = (env: RuleEnvironment, state: GameState, id: number, ended?: EndedWith): GameState => {
  const record = state.session.runningActions[id];
  if (!isDefined(record)) return state;
  const without = {
    ...state,
    session: { ...state.session, runningActions: _.omit(state.session.runningActions, id) },
  };
  if (sceneRun(state, record.scope) !== record.run) return without;
  const name = record.action.name;
  const announced = isDefined(name)
    ? fireEverywhere(env, without, endPick(name, record.event, ended), record.where)
    : without;
  return isDefined(record.parent) ? partEnded(env, announced, record.parent) : announced;
};

/** Applies one rule of a scene: checks its `if`, then starts its actions in order. */
export const applyRule = (run: RuleRun, state: GameState, ruleIndex: number): GameState => {
  const rule = run.scene.component.rules![ruleIndex];
  const where = `${run.scene.scope} › rules[${ruleIndex}]`;
  if (isDefined(rule.if) && !evaluate(run, state, rule.if, `${where}.if`)) return state;
  return rule.do.reduce(
    (current, action, a) => startAction(run, current, action, { where: `${where}.do[${a}]` }),
    state,
  );
};

/**
 * Runs an action whose delay is over, against the latest state. Its rule's `if` isn't checked again.
 * @returns the state, unchanged, if its scene has closed or reset since the rule fired
 */
export const applyDelayedAction = (
  env: RuleEnvironment,
  state: GameState,
  { scope, run, action, event, where, actionId }: DelayedAction,
): GameState => {
  const scene = getShownScenes(state).find((d) => d.scope === scope);
  if (!isDefined(scene) || sceneRun(state, scope) !== run) return state;
  const ruleRun = { env, scene, event };
  if (isDefined(actionId)) return beginAction(ruleRun, state, actionId);
  return isGroup(action) ? state : play(ruleRun, state, action, { where })[0];
};

/**
 * Fires the rules of one shown scene that `pick` chooses, in order.
 * @param pick the event a rule fires with, or undefined if its trigger doesn't match
 * @returns the new state; the given state, unchanged, if the scene isn't shown or no rule changed anything
 */
export const fireRules = (env: RuleEnvironment, state: GameState, scope: SceneScope, pick: RulePick): GameState => {
  const scene = getShownScenes(state).find((d) => d.scope === scope);
  if (!isDefined(scene)) return state;
  return (scene.component.rules ?? []).reduce((current, rule, ruleIndex) => {
    const event = pick(rule.on, ruleIndex);
    return isDefined(event) ? applyRule({ env, scene, event }, current, ruleIndex) : current;
  }, state);
};
