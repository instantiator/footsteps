import type { GameData } from "../../../entities/data/GameData";
import {
  GAME_INTERACTIONS,
  type GameAction,
  type GameDisplayBase,
  type GameEffectAction,
  type GameInteractTrigger,
  type GameRule,
  type GameTrigger,
  type GameWhenTrigger,
} from "../../../entities/data/displays/GameDisplayData";
import { isDefined } from "../../../util/ObjectUtils";
import { compileGameExpression, type GameExpression } from "./GameExpressionUtils";
import { isEntering, triggerInteractions, type GameExpressions } from "./GameRuleUtils";

/** Actions that act on the display's own challenge, so only make sense on challenge displays. */
const CHALLENGE_ACTIONS = ["completeChallenge", "answer", "resetChallenge"] as const;

/** A display to check, with a readable path to it for error messages. */
interface DisplayToCompile {
  display: Pick<GameDisplayBase, "component" | "resetDisplay">;
  path: string;
  isChallenge: boolean;
  /** Whether it is a reset display, where `finishReset` can be used. */
  isReset: boolean;
}

/** A display, followed by its reset display, and theirs. */
const withResets = (target: DisplayToCompile): DisplayToCompile[] =>
  isDefined(target.display.resetDisplay)
    ? [
        target,
        ...withResets({
          ...target,
          display: target.display.resetDisplay,
          path: `${target.path} › resetDisplay`,
          isReset: true,
        }),
      ]
    : [target];

/** Every display in the game, overview, stage and challenge, and their reset displays, with its path. */
const allDisplays = (gameData: GameData): DisplayToCompile[] =>
  [
    ...gameData.displays.map((display, d) => ({
      display,
      path: `displays[${d}] (${display.purpose})`,
      isChallenge: false,
      isReset: false,
    })),
    ...gameData.stages.flatMap((stage, s) => {
      const stagePath = `stages[${s}] (${stage.id})`;
      return [
        ...(stage.displays ?? []).map((display, d) => ({
          display,
          path: `${stagePath} › displays[${d}] (${display.purpose})`,
          isChallenge: false,
          isReset: false,
        })),
        ...stage.challenges.flatMap((challenge, c) =>
          challenge.displays.map((display, d) => ({
            display,
            path: `${stagePath} › challenges[${c}] (${challenge.id}) › displays[${d}] (${display.purpose})`,
            isChallenge: true,
            isReset: false,
          })),
        ),
      ];
    }),
  ].flatMap(withResets);

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

/** The camera interactions that were renamed with an `-enter` suffix, named in the error for old game data. */
const RENAMED_INTERACTIONS = ["hand", "foot", "head", "body", "any"];

/**
 * Checks that every interaction an interact trigger names exists.
 * @throws naming `where`, and the new name of an interaction that was renamed
 */
const checkInteractions = (trigger: GameInteractTrigger, where: string): void => {
  const names: readonly string[] = triggerInteractions(trigger);
  for (const name of names) {
    if (GAME_INTERACTIONS.some((interaction) => interaction === name)) continue;
    const hint = RENAMED_INTERACTIONS.includes(name) ? `; "${name}" is now "${name}-enter"` : "";
    throw new Error(`${where}: there is no interaction "${name}"${hint}`);
  }
};

/**
 * Checks that a trigger's `holdMs` is a time to stay over the element, on entering interactions only.
 * @throws naming `where` if not
 */
const checkHold = (trigger: GameInteractTrigger, where: string): void => {
  if (!isDefined(trigger.holdMs)) return;
  if (trigger.holdMs < 0) throw new Error(`${where}: a duration can't be negative`);
  const other = triggerInteractions(trigger).find((interaction) => !isEntering(interaction));
  if (isDefined(other)) throw new Error(`${where}: only entering interactions can be held, not "${other}"`);
};

/** A `when` trigger's expression, checking its `forMs`. */
const whenSources = (trigger: GameWhenTrigger, where: string): [string, string][] => {
  if ((trigger.forMs ?? 0) < 0) throw new Error(`${where}.forMs: a duration can't be negative`);
  return [[trigger.when, `${where}.when`]];
};

/** The selector and expressions a trigger needs, checking any fixed duration. */
const triggerSources = (trigger: GameTrigger, where: string): [string, string][] => {
  if ("interact" in trigger) {
    checkInteractions(trigger, `${where}.interact`);
    checkHold(trigger, `${where}.holdMs`);
  }
  if ("target" in trigger) {
    checkSelector(trigger.target, `${where}.target`);
    return [];
  }
  if ("when" in trigger) return whenSources(trigger, where);
  const duration = "every" in trigger ? trigger.every : "after" in trigger ? trigger.after : undefined;
  if (typeof duration === "string") return [[duration, where]];
  if (typeof duration === "number" && duration < 0) throw new Error(`${where}: a duration can't be negative`);
  return [];
};

/** Why a sound or reward can't be played, or undefined if it can. */
const effectProblem = (effect: GameEffectAction, gameData: GameData): string | undefined => {
  if ("sound" in effect && !Object.hasOwn(gameData.resources ?? {}, effect.sound)) {
    return `there is no resource "${effect.sound}" to play`;
  }
  return (effect.delayMs ?? 0) < 0 ? "delayMs can't be negative" : undefined;
};

/** Why an action can't be used on this display, or undefined if it can. */
const actionProblem = (action: GameAction, target: DisplayToCompile, gameData: GameData): string | undefined => {
  const challengeAction = CHALLENGE_ACTIONS.find((name) => name in action);
  if (challengeAction && !target.isChallenge) return `${challengeAction} can only be used on a challenge display`;
  if ("finishReset" in action && !target.isReset) return "finishReset can only be used on a reset display";
  if ("enterStage" in action && !gameData.stages.some((stage) => stage.id === action.enterStage)) {
    return `there is no stage "${action.enterStage}"`;
  }
  return "sound" in action || "reward" in action ? effectProblem(action, gameData) : undefined;
};

/** The expressions an action needs, checking it is allowed on this display. */
const actionSources = (
  action: GameAction,
  where: string,
  target: DisplayToCompile,
  gameData: GameData,
): [string, string][] => {
  const problem = actionProblem(action, target, gameData);
  if (isDefined(problem)) throw new Error(`${where}: ${problem}`);
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
