import _ from "lodash";
import type { GameData, GameId } from "../../../entities/data/GameData";
import type {
  GameAction,
  GameDisplayBase,
  GameRule,
  GameTrigger,
} from "../../../entities/data/displays/GameDisplayData";
import { toGameSnapshot } from "../../../entities/state/GameSnapshot";
import type { DisplayScope, GameState } from "../../../entities/state/GameState";
import { enterStage } from "./GameClickUtils";
import {
  compileGameExpression,
  evaluateGameExpression,
  type ExpressionContext,
  type GameExpression,
} from "./GameExpressionUtils";
import { findChallengeState } from "./GameDataUtils";
import { completeChallenge, resetChallenge, validateAnswer } from "./GameStateUtils";
import { getDisplayState, getShownDisplays, type ShownDisplay } from "./RenderDataUtils";
import { isDefined } from "../../../util/ObjectUtils";

/** Every expression in a game's rules, compiled once when the game loads, by source text. */
export type GameExpressions = ReadonlyMap<string, GameExpression>;

/** Actions that act on the display's own challenge, so only make sense on challenge displays. */
const CHALLENGE_ACTIONS = ["completeChallenge", "answer", "resetChallenge"] as const;

/** A display to check, with a readable path to it for error messages. */
interface DisplayToCompile {
  display: GameDisplayBase;
  path: string;
  isChallenge: boolean;
}

/** Every display in the game, overview, stage and challenge, with its path. */
const allDisplays = (gameData: GameData): DisplayToCompile[] => [
  ...gameData.displays.map((display, d) => ({
    display,
    path: `displays[${d}] (${display.purpose})`,
    isChallenge: false,
  })),
  ...gameData.stages.flatMap((stage, s) => {
    const stagePath = `stages[${s}] (${stage.id})`;
    return [
      ...(stage.displays ?? []).map((display, d) => ({
        display,
        path: `${stagePath} › displays[${d}] (${display.purpose})`,
        isChallenge: false,
      })),
      ...stage.challenges.flatMap((challenge, c) =>
        challenge.displays.map((display, d) => ({
          display,
          path: `${stagePath} › challenges[${c}] (${challenge.id}) › displays[${d}] (${display.purpose})`,
          isChallenge: true,
        })),
      ),
    ];
  }),
];

/**
 * Checks that a selector parses, where there is a DOM to parse it with (not in the validation script).
 * @throws naming `where` if it doesn't
 */
const checkSelector = (selector: string, where: string): void => {
  if (typeof document === "undefined") return;
  try {
    document.createDocumentFragment().querySelector(selector);
  } catch {
    throw new Error(`${where}: "${selector}" is not a valid CSS selector`);
  }
};

/** The selector and expressions a trigger needs, checking any fixed duration. */
const triggerSources = (trigger: GameTrigger, where: string): [string, string][] => {
  if ("target" in trigger) {
    checkSelector(trigger.target, `${where}.target`);
    return [];
  }
  if ("when" in trigger) return [[trigger.when, `${where}.when`]];
  const duration = "every" in trigger ? trigger.every : "after" in trigger ? trigger.after : undefined;
  if (typeof duration === "string") return [[duration, where]];
  if (typeof duration === "number" && duration < 0) throw new Error(`${where}: a duration can't be negative`);
  return [];
};

/** The expressions an action needs, checking it is allowed on this display. */
const actionSources = (
  action: GameAction,
  where: string,
  target: DisplayToCompile,
  gameData: GameData,
): [string, string][] => {
  const challengeAction = CHALLENGE_ACTIONS.find((name) => name in action);
  if (challengeAction && !target.isChallenge) {
    throw new Error(`${where}: ${challengeAction} can only be used on a challenge display`);
  }
  if ("enterStage" in action && !gameData.stages.some((stage) => stage.id === action.enterStage)) {
    throw new Error(`${where}: there is no stage "${action.enterStage}"`);
  }
  if ("set" in action) return Object.entries(action.set).map(([key, source]) => [source, `${where}.set.${key}`]);
  if ("answer" in action) return [[action.answer, `${where}.answer`]];
  return [];
};

/** Every expression source in a rule, with where it is, checking selectors and actions on the way. */
const ruleSources = (
  rule: GameRule,
  where: string,
  target: DisplayToCompile,
  gameData: GameData,
): [string, string][] => [
  ...triggerSources(rule.on, `${where}.on`),
  ...(rule.if === undefined ? [] : [[rule.if, `${where}.if`] satisfies [string, string]]),
  ...rule.do.flatMap((action, a) => actionSources(action, `${where}.do[${a}]`, target, gameData)),
];

/**
 * Compiles and checks every rule in a game, so a mistake is reported when the game loads, naming the
 * display and rule it is in.
 * @returns the compiled expressions, by source text
 * @throws on the first expression that doesn't parse, invalid selector, negative duration, challenge action
 * outside a challenge display, or `enterStage` to a stage the game doesn't have
 */
export const compileGameRules = (gameData: GameData): GameExpressions => {
  const expressions = new Map<string, GameExpression>();
  for (const target of allDisplays(gameData)) {
    (target.display.component.rules ?? []).forEach((rule, r) => {
      for (const [source, where] of ruleSources(rule, `${target.path} › rules[${r}]`, target, gameData)) {
        if (!expressions.has(source)) expressions.set(source, compileGameExpression(source, where));
      }
    });
  }
  return expressions;
};

/**
 * Returns displays with `resetStateOnShow` to their `initialState` when they become shown. It runs on every game
 * state change, in the same update, so a reset display never renders its old state.
 * @param previous the state before the change, or undefined when the game starts
 */
export const applyShowResets = (previous: GameState | undefined, next: GameState): GameState => {
  const wasShown = new Set(isDefined(previous) ? getShownDisplays(previous).map((d) => d.scope) : []);
  const resets = getShownDisplays(next).filter(
    (d) =>
      d.component.resetStateOnShow === true && !wasShown.has(d.scope) && Object.hasOwn(next.displayStates, d.scope),
  );
  if (resets.length === 0) return next;
  const displayStates = { ...next.displayStates };
  for (const { scope } of resets) delete displayStates[scope];
  return { ...next, displayStates };
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
export const NO_EVENT: RuleEvent = { id: "", interaction: "" };

/** Most `when` rounds that may fire in a row before the chain counts as a loop and is stopped. */
export const MAX_WHEN_CHAIN = 10;

/** One rule firing: the environment, the display it belongs to, and the event it fired with. */
interface RuleRun {
  /** The game's id and compiled expressions. */
  env: RuleEnvironment;
  /** The display whose rule it is. */
  display: ShownDisplay;
  /** What expressions see as `event`. */
  event: RuleEvent;
}

/** Evaluates an expression source for a display, compiling it if it wasn't compiled at load (eg. in tests). */
const evaluate = ({ env, display, event }: RuleRun, state: GameState, source: string, where: string): unknown => {
  const context: ExpressionContext = {
    state: getDisplayState(state, display.scope, display.component),
    data: display.component.data,
    game: toGameSnapshot(env.gameId, state),
    event,
  };
  return evaluateGameExpression(env.expressions.get(source) ?? compileGameExpression(source, where), context, where);
};

/** Sets the display's state keys to their expressions' values, all worked out from the state before the action. */
const applySet = (run: RuleRun, state: GameState, values: Record<string, string>, where: string): GameState => {
  const updates = _.omitBy(
    _.mapValues(values, (source, key) => evaluate(run, state, source, `${where}.set.${key}`)),
    _.isUndefined,
  );
  const { scope, component } = run.display;
  return {
    ...state,
    displayStates: { ...state.displayStates, [scope]: { ...getDisplayState(state, scope, component), ...updates } },
  };
};

/** Submits an answer to the display's challenge; a correct one completes it, as a typed answer does. */
const applyAnswer = (state: GameState, { stageId, challengeId }: ShownDisplay, answer: unknown): GameState => {
  const challengeState = findChallengeState(state, stageId!, challengeId!);
  if (challengeState.succeeded || validateAnswer(challengeState.challenge, String(answer)) !== true) return state;
  return completeChallenge(state, stageId!, challengeId!);
};

/** Applies one action. Challenge actions are only on challenge displays, as checked when the game loads. */
const applyAction = (run: RuleRun, state: GameState, action: GameAction, where: string): GameState => {
  const { scope, stageId, challengeId } = run.display;
  if ("set" in action) return applySet(run, state, action.set, where);
  if ("resetState" in action) return { ...state, displayStates: _.omit(state.displayStates, scope) };
  if ("answer" in action)
    return applyAnswer(state, run.display, evaluate(run, state, action.answer, `${where}.answer`));
  if ("completeChallenge" in action) {
    const done = findChallengeState(state, stageId!, challengeId!).succeeded;
    return done ? state : completeChallenge(state, stageId!, challengeId!);
  }
  if ("resetChallenge" in action) return resetChallenge(state, stageId!, challengeId!);
  return enterStage(state, action.enterStage) ?? state;
};

/** Applies one rule of a display: checks its `if`, then applies its actions in order. */
const applyRule = (run: RuleRun, state: GameState, ruleIndex: number): GameState => {
  const rule = run.display.component.rules![ruleIndex];
  const where = `${run.display.scope} › rules[${ruleIndex}]`;
  if (isDefined(rule.if) && !evaluate(run, state, rule.if, `${where}.if`)) return state;
  return rule.do.reduce((current, action, a) => applyAction(run, current, action, `${where}.do[${a}]`), state);
};

/**
 * Fires the rules of one shown display that `pick` chooses, in order.
 * @param pick the event a rule fires with, or undefined if its trigger doesn't match
 * @returns the new state; the given state, unchanged, if the display isn't shown or no rule changed anything
 */
export const fireRules = (
  env: RuleEnvironment,
  state: GameState,
  scope: DisplayScope,
  pick: (trigger: GameTrigger, ruleIndex: number) => RuleEvent | undefined,
): GameState => {
  const display = getShownDisplays(state).find((d) => d.scope === scope);
  if (!isDefined(display)) return state;
  return (display.component.rules ?? []).reduce((current, rule, ruleIndex) => {
    const event = pick(rule.on, ruleIndex);
    return isDefined(event) ? applyRule({ env, display, event }, current, ruleIndex) : current;
  }, state);
};

/** Each `when` rule's last value, keyed `<scope>#<rule index>`, for spotting false-to-true changes. */
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
 * Evaluates the `when` rules of the shown displays against one state, then fires those that changed from false to
 * true, in order. A rule seen for the first time (its display has just been shown) only records its value.
 * @param fire false to only record values
 */
const whenRound = (env: RuleEnvironment, state: GameState, edges: WhenEdges, fire = true): WhenRound => {
  const values = new Map<string, boolean>();
  const firing: [ShownDisplay, number, string][] = [];
  for (const display of getShownDisplays(state)) {
    (display.component.rules ?? []).forEach((rule, ruleIndex) => {
      if (!("when" in rule.on)) return;
      const key = `${display.scope}#${ruleIndex}`;
      const where = `${display.scope} › rules[${ruleIndex}].on.when`;
      const value = Boolean(evaluate({ env, display, event: NO_EVENT }, state, rule.on.when, where));
      if (fire && edges.get(key) === false && value) firing.push([display, ruleIndex, key]);
      values.set(key, value);
    });
  }
  const next = firing.reduce(
    (current, [display, ruleIndex]) => applyRule({ env, display, event: NO_EVENT }, current, ruleIndex),
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
