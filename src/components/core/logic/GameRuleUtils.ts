import type { GameData } from "../../../entities/data/GameData";
import type {
  GameAction,
  GameDisplayBase,
  GameRule,
  GameTrigger,
} from "../../../entities/data/displays/GameDisplayData";
import type { GameState } from "../../../entities/state/GameState";
import { compileGameExpression, type GameExpression } from "./GameExpressionUtils";
import { getShownDisplays } from "./RenderDataUtils";
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
