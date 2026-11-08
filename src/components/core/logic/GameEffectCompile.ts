import {
  GAME_INTERACTIONS,
  POINTER_INTERACTIONS,
  type GameAction,
  type GameEffectEndTrigger,
  type GameInteractTrigger,
  type GameRewardAction,
  type GameRule,
} from "../../../entities/data/scenes/GameSceneData";
import {
  GAME_EFFECT_NAMES,
  type GameEffect,
  type GameEffectPosition,
  type GameHighlightStep,
} from "../../../entities/data/scenes/GameEffectData";
import { isDefined } from "../../../util/ObjectUtils";
import { triggerInteractions } from "./GameRuleUtils";

/** Why game data is wrong, or undefined if it isn't. */
type Problem = string | undefined;

/** The effects that must run to their end, so can't be stopped or last for ever. */
const MUST_FINISH = ["player-fall", "player-spin-away"];

/** The effects that change a player for good, so have nothing running to stop, and nothing to loop. */
const ONE_WAY = ["player-invisible", "player-visible", "player-restore"];

/** The effects `stop` can't end: those that must finish, those that apply once, and itself. */
const UNSTOPPABLE = [...MUST_FINISH, ...ONE_WAY, "player-freeze", "player-unfreeze", "stop"];

/** The interactions that fire on being near an element. */
const NEAR_INTERACTIONS = ["near-enter", "near-exit"];

/** Whether a selector names a player, as those can't be treated like other elements. */
export const targetsPlayers = (selector: string | undefined): boolean =>
  isDefined(selector) && /\.player(-\d+)?\b/.test(selector);

/**
 * Checks that a selector parses, where there is a DOM to parse it with (not in the validation script).
 * @throws naming `where` if it doesn't
 */
export const checkSelector = (selector: string, where: string): void => {
  if (typeof document === "undefined") return;
  try {
    document.createDocumentFragment().querySelector(selector);
  } catch {
    throw new Error(`${where}: "${selector}" is not a valid CSS selector`);
  }
};

/** Whether a selector parses; see {@link checkSelector}. */
const selectorProblem = (selector: string | undefined, name: string): Problem => {
  if (!isDefined(selector)) return undefined;
  try {
    checkSelector(selector, name);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/** Why an easing can't be used, where there is a browser to ask (not in tests or the validation script). */
const easingProblem = (easing: string | undefined, name: string): Problem => {
  if (!isDefined(easing) || typeof CSS === "undefined" || typeof CSS.supports !== "function") return undefined;
  return CSS.supports("animation-timing-function", easing) ? undefined : `${name}: "${easing}" is not a CSS easing`;
};

/** Why a time can't be used. */
const timeProblem = (value: unknown, name: string): Problem =>
  typeof value === "number" && value < 0 ? `${name} can't be negative` : undefined;

/** The first of the problems found, if any. */
const firstProblem = (...problems: Problem[]): Problem => problems.find(isDefined);

/** Why a value can't be a fraction. */
const fractionProblem = (value: number | undefined, name: string): Problem =>
  isDefined(value) && (value < 0 || value > 1) ? `${name} must be between 0 and 1` : undefined;

/** Why a position's other element can't be found. */
const positionProblem = (position: GameEffectPosition | undefined, name: string): Problem =>
  isDefined(position) && "from" in position ? selectorProblem(position.from, `${name}.from`) : undefined;

/** Why a highlight's step can't play. */
const stepProblem = ({ durationMs, easing }: GameHighlightStep, s: number): Problem =>
  firstProblem(timeProblem(durationMs, `sequence[${s}].durationMs`), easingProblem(easing, `sequence[${s}].easing`));

/** Why a highlight can't play on what it targets. */
const highlightProblem = ({ sequence, target }: Extract<GameEffect, { effect: "highlight" }>): Problem => {
  if (!Array.isArray(sequence) || sequence.length === 0) return "highlight needs a sequence";
  const drawsAround = sequence.some((step) => isDefined(step.shadow) || isDefined(step.outline));
  if (targetsPlayers(target) && drawsAround) {
    return "shadow and outline would draw around the whole scene, not the player; use filter: drop-shadow() instead";
  }
  return firstProblem(...sequence.map(stepProblem));
};

/** Why an item move can't happen. */
const moveProblem = ({ start, end }: Extract<GameEffect, { effect: "item-move" }>): Problem => {
  if (!isDefined(end)) return "item-move needs an end";
  return firstProblem(positionProblem(start, "start"), positionProblem(end, "end"));
};

/** Why a spin away can't happen. */
const spinProblem = ({ angle, zoom, opacity }: Extract<GameEffect, { effect: "player-spin-away" }>): Problem => {
  if (isDefined(angle) && angle.min > angle.max) return "angle.min can't be above angle.max";
  if (isDefined(zoom) && zoom <= 0) return "zoom must be above 0";
  return fractionProblem(opacity, "opacity");
};

/** Why static can't show. */
const staticProblem = ({
  pixelSize,
  proportion,
  easeMs,
}: Extract<GameEffect, { effect: "player-static" }>): Problem => {
  if (isDefined(pixelSize) && pixelSize <= 0) return "pixelSize must be above 0";
  return firstProblem(fractionProblem(proportion, "proportion"), timeProblem(easeMs, "easeMs"));
};

/** Why an effect that moves an item can't move this target. */
const movesPlayerProblem = ({
  effect,
  target,
}: Extract<GameEffect, { effect: "item-fall" | "item-move" }>): Problem => {
  if (!targetsPlayers(target)) return undefined;
  return effect === "item-fall"
    ? "item-fall would move a player's image while they stayed active; use player-fall instead"
    : "item-move would move a player's image away from where they are really interacting";
};

/** Why `stop` can't stop what it names. */
const stopProblem = ({ stop }: Extract<GameEffect, { effect: "stop" }>): Problem => {
  if (!isDefined(stop)) return undefined;
  if (!GAME_EFFECT_NAMES.some((name) => name === stop)) return `there is no effect "${stop}" to stop`;
  return UNSTOPPABLE.includes(stop) ? `${stop} can't be stopped` : undefined;
};

/** The checks only one kind of effect has. */
const ownProblem = (effect: GameEffect): Problem => {
  switch (effect.effect) {
    case "highlight":
      return highlightProblem(effect);
    case "item-fall":
      return movesPlayerProblem(effect);
    case "item-move":
      return moveProblem(effect) ?? movesPlayerProblem(effect);
    case "player-spin-away":
      return spinProblem(effect);
    case "player-static":
      return staticProblem(effect);
    case "stop":
      return stopProblem(effect);
    default:
      return undefined;
  }
};

/** Why an effect can't run, or undefined if it can. */
export const effectProblem = (effect: GameEffect): Problem => {
  const { durationMs, cycleMs, easing, target } = {
    durationMs: undefined,
    cycleMs: undefined,
    easing: undefined,
    target: undefined,
    ...effect,
  };
  if (!GAME_EFFECT_NAMES.includes(effect.effect)) return `there is no effect "${String(effect.effect)}"`;
  if (durationMs === "indefinite" && [...MUST_FINISH, ...ONE_WAY].includes(effect.effect)) {
    return `durationMs can't be "indefinite" on ${effect.effect}, as it must finish`;
  }
  return firstProblem(
    timeProblem(durationMs, "durationMs"),
    timeProblem(cycleMs, "cycleMs"),
    easingProblem(easing, "easing"),
    selectorProblem(target, "target"),
    ownProblem(effect),
  );
};

/** Why a reward can't start from what it names, or undefined if it can. */
export const rewardProblem = ({ target }: GameRewardAction): Problem => selectorProblem(target, "target");

/** Whether an action only means anything with a player there. */
const needsPlayer = (action: GameAction): string | undefined => {
  const name = "effect" in action ? action.effect : "reward" in action ? "reward" : undefined;
  if (!isDefined(name)) return undefined;
  const namesPlayer =
    name.startsWith("player-") ||
    ("players" in action && isDefined(action.players)) ||
    ("target" in action && targetsPlayers(action.target));
  return namesPlayer ? name : undefined;
};

/** Why an action can't be used on a scene where the camera can never be on, or undefined if it can. */
export const needsPlayerProblem = (action: GameAction): Problem => {
  const name = needsPlayer(action);
  return isDefined(name) ? `${name} needs a player, but this scene doesn't have the camera enabled` : undefined;
};

/** Why a rule can't fire on a scene where the camera can never be on, or undefined if it can. */
export const cameraOnlyRuleProblem = ({ on }: GameRule): Problem => {
  if (!("interact" in on)) return undefined;
  const pointer: readonly string[] = POINTER_INTERACTIONS;
  if (triggerInteractions(on).some((interaction) => pointer.includes(interaction))) return undefined;
  return "nothing can fire this rule, as its interactions all need the camera, and this scene doesn't have it enabled";
};

/**
 * Checks what an interact trigger must have for what it does: a target, unless only for `jump`, and a `within` if, and
 * only if, it is for being near.
 * @throws naming `where` if it hasn't
 */
export const checkInteractTrigger = (trigger: GameInteractTrigger, where: string): void => {
  const names = triggerInteractions(trigger).filter((name) => GAME_INTERACTIONS.includes(name));
  if (!isDefined(trigger.target) && names.some((name) => name !== "jump")) {
    throw new Error(`${where}.target: only "jump" on its own can leave out target`);
  }
  const isNear = names.some((name) => NEAR_INTERACTIONS.includes(name));
  if (isNear && !isDefined(trigger.within)) throw new Error(`${where}.within: near interactions need within`);
  if (!isNear && isDefined(trigger.within)) throw new Error(`${where}.within: only near interactions have within`);
  if ((trigger.within ?? 0) < 0) throw new Error(`${where}.within: a distance can't be negative`);
};

/**
 * Checks that an effect end trigger names an effect that can end.
 * @throws naming `where` if it doesn't
 */
export const checkEffectEnd = ({ effectEnd }: GameEffectEndTrigger, where: string): void => {
  if (effectEnd === "stop" || !GAME_EFFECT_NAMES.some((name) => name === effectEnd)) {
    throw new Error(`${where}.effectEnd: there is no effect "${effectEnd}" to end`);
  }
};
