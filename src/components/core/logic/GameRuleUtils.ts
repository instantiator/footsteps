import type {
  GameAction,
  GameInteraction,
  GameInteractTrigger,
  PointerInteraction,
  GameTrigger,
} from "../../../entities/data/scenes/GameSceneData";
import type { SceneScope, GameState } from "../../../entities/state/GameState";
import { applyRule } from "./ActionRuns";
import { forgetFinishedResets, sceneRun, startSceneRuns } from "./GameStateUtils";
import { getSceneSlots, getShownScenes, type ShownScene } from "./RenderDataUtils";
import { evaluate, NO_EVENT, timeOf, type RuleEnvironment, type RuleEvent } from "./RuleActions";
import { matchTarget, type SceneDomEvent } from "./TemplateUtils";
import { isDefined } from "../../../util/ObjectUtils";

export { applyDelayedAction, fireRules } from "./ActionRuns";
export { NO_EVENT, type GameExpressions, type RuleEnvironment, type RuleEvent } from "./RuleActions";

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

/** Most `when` rounds that may fire in a row before the chain counts as a loop and is stopped. */
export const MAX_WHEN_CHAIN = 10;

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
 * true, in order. A rule seen for the first time (its scene has just been shown or reset) fires if it is already true.
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
      if (fire && immediate && edges.get(key) !== true && value) firing.push([scene, ruleIndex, key]);
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

/**
 * Every action in a list and in the groups within it, each with where it is.
 * @param where where the list is, eg. `… › rules[0].do`
 */
export const actionsWithin = (actions: GameAction[], where: string): [GameAction, string][] =>
  actions.flatMap((action, a): [GameAction, string][] => {
    const at = `${where}[${a}]`;
    if ("series" in action) return [[action, at], ...actionsWithin(action.series, `${at}.series`)];
    if ("parallel" in action) return [[action, at], ...actionsWithin(action.parallel, `${at}.parallel`)];
    return [[action, at]];
  });

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
  if (!isDefined(value)) return undefined;
  const ms = timeOf({ env, scene, event: NO_EVENT }, state, value, `${scene.scope} › rules[${ruleIndex}].on`);
  return isDefined(ms) && "every" in trigger ? Math.max(ms, MIN_EVERY_MS) : ms;
};
