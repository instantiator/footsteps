import type { GameData } from "../../../entities/data/GameData";
import type { GameStageData } from "../../../entities/data/GameStageData";
import {
  GAME_INTERACTIONS,
  type GameAction,
  type GameSceneBase,
  type GameSceneCameraData,
  type GameFeedbackAction,
  type GameInteractTrigger,
  type GameRule,
  type GameTrigger,
  type GameWhenTrigger,
} from "../../../entities/data/scenes/GameSceneData";
import { isDefined } from "../../../util/ObjectUtils";
import { compileGameExpression, type GameExpression } from "./GameExpressionUtils";
import {
  cameraOnlyRuleProblem,
  checkEffectEnd,
  checkInteractTrigger,
  checkSelector,
  effectProblem,
  needsPlayerProblem,
  rewardProblem,
} from "./GameEffectCompile";
import { declaredValue } from "./CameraModeUtils";
import { isEntering, triggerInteractions, type GameExpressions } from "./GameRuleUtils";

/** Actions that act on the display's own challenge, so only make sense on challenge displays. */
const CHALLENGE_ACTIONS = ["completeChallenge", "answer", "resetChallenge"] as const;

/** A display to check, with a readable path to it for error messages. */
interface DisplayToCompile {
  display: Pick<GameSceneBase, "component" | "camera" | "resetScene">;
  path: string;
  isChallenge: boolean;
  /** Whether it is a reset display, where `finishReset` can be used. */
  isReset: boolean;
  /** Whether the camera could ever be on while it shows. */
  cameraCanBeOn: boolean;
}

/** What a display inherits its camera from, when it doesn't say: a broader display's setting, or the game's. */
type CameraInheritance = {
  /** Whether a broader display or the game turns the camera on; undefined if none says. */
  inherited: boolean | undefined;
  /** Whether a display shown alongside it turns the camera on, which turns it on for all of them. */
  alongside: boolean;
};

/** Whether the camera could ever be on for a display, by the inheritance in `CameraModeUtils.ts`. */
const canCameraBeOn = (camera: GameSceneCameraData | undefined, { inherited, alongside }: CameraInheritance) =>
  alongside || (declaredValue("enabled", camera) ?? inherited) === true;

/** A display, followed by its reset display, and theirs, each using its own camera setting over its parent's. */
const withResets = (target: DisplayToCompile, camera: CameraInheritance): DisplayToCompile[] => {
  const reset = target.display.resetScene;
  if (!isDefined(reset)) return [target];
  const merged = { ...target.display.camera, ...reset.camera };
  return [
    target,
    ...withResets(
      {
        ...target,
        display: { ...reset, camera: merged },
        path: `${target.path} › resetScene`,
        isReset: true,
        cameraCanBeOn: canCameraBeOn(merged, camera),
      },
      camera,
    ),
  ];
};

/** The value several displays' camera settings give together: on if any is on, otherwise off if any is off. */
const anyDeclared = (scenes: Pick<GameSceneBase, "camera">[]): boolean | undefined => {
  const values = scenes.map(({ camera }) => declaredValue("enabled", camera)).filter(isDefined);
  return values.length === 0 ? undefined : values.includes(true);
};

/** A display's place in the game, with what it inherits. */
type DisplayPlace = Pick<DisplayToCompile, "path" | "isChallenge"> & CameraInheritance;

/** A display to check, and its reset displays, at their place in the game. */
const compilable = (display: DisplayToCompile["display"], { path, isChallenge, ...camera }: DisplayPlace) =>
  withResets(
    { display, path, isChallenge, isReset: false, cameraCanBeOn: canCameraBeOn(display.camera, camera) },
    camera,
  );

/** A stage's displays to check, with what they inherit. */
const stageDisplays = (stage: GameStageData, s: number, fromOverview: boolean | undefined): DisplayToCompile[] => {
  const stagePath = `stages[${s}] (${stage.id})`;
  const challengesOn = stage.challenges.map((challenge) => anyDeclared(challenge.scenes) === true);
  const inherited = anyDeclared(stage.scenes ?? []) ?? fromOverview;
  return [
    ...(stage.scenes ?? []).flatMap((display, d) =>
      compilable(display, {
        path: `${stagePath} › displays[${d}] (${display.purpose})`,
        isChallenge: false,
        inherited: fromOverview,
        alongside: challengesOn.includes(true),
      }),
    ),
    ...stage.challenges.flatMap((challenge, c) =>
      challenge.scenes.flatMap((display, d) =>
        compilable(display, {
          path: `${stagePath} › challenges[${c}] (${challenge.id}) › displays[${d}] (${display.purpose})`,
          isChallenge: true,
          inherited,
          // ponytail: any other challenge counts if the stage shows several at once, even in another chunk
          alongside: (stage.challengeChunking ?? 1) > 1 && challengesOn.some((on, other) => on && other !== c),
        }),
      ),
    ),
  ];
};

/** Every display in the game, overview, stage and challenge, and their reset displays, with its path. */
const allDisplays = (gameData: GameData): DisplayToCompile[] => {
  const fromGame = declaredValue("enabled", gameData.modules?.camera);
  const fromOverview = anyDeclared(gameData.scenes) ?? fromGame;
  return [
    ...gameData.scenes.flatMap((display, d) =>
      compilable(display, {
        path: `displays[${d}] (${display.purpose})`,
        isChallenge: false,
        inherited: fromGame,
        alongside: false,
      }),
    ),
    ...gameData.stages.flatMap((stage, s) => stageDisplays(stage, s, fromOverview)),
  ];
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

/** Checks what only an interact or effect end trigger has. */
const checkTrigger = (trigger: GameTrigger, where: string): void => {
  if ("interact" in trigger) {
    checkInteractions(trigger, `${where}.interact`);
    checkHold(trigger, `${where}.holdMs`);
    checkInteractTrigger(trigger, where);
  }
  if ("effectEnd" in trigger) checkEffectEnd(trigger, where);
};

/** The selector and expressions a trigger needs, checking any fixed duration. */
const triggerSources = (trigger: GameTrigger, where: string): [string, string][] => {
  checkTrigger(trigger, where);
  if ("target" in trigger) {
    if (isDefined(trigger.target)) checkSelector(trigger.target, `${where}.target`);
    return [];
  }
  if ("when" in trigger) return whenSources(trigger, where);
  const duration = "every" in trigger ? trigger.every : "after" in trigger ? trigger.after : undefined;
  if (typeof duration === "string") return [[duration, where]];
  if (typeof duration === "number" && duration < 0) throw new Error(`${where}: a duration can't be negative`);
  return [];
};

/** Why a sound or reward can't be played, or undefined if it can. */
const feedbackProblem = (feedback: GameFeedbackAction, gameData: GameData): string | undefined => {
  if ("reward" in feedback) return rewardProblem(feedback);
  return Object.hasOwn(gameData.resources ?? {}, feedback.sound)
    ? undefined
    : `there is no resource "${feedback.sound}" to play`;
};

/** Why an action can't be used on this display, or undefined if it can. */
const actionProblem = (action: GameAction, target: DisplayToCompile, gameData: GameData): string | undefined => {
  const challengeAction = CHALLENGE_ACTIONS.find((name) => name in action);
  if (challengeAction && !target.isChallenge) return `${challengeAction} can only be used on a challenge display`;
  if ("finishReset" in action && !target.isReset) return "finishReset can only be used on a reset display";
  if ("enterStage" in action && !gameData.stages.some((stage) => stage.id === action.enterStage)) {
    return `there is no stage "${action.enterStage}"`;
  }
  if ("sound" in action || "reward" in action) return feedbackProblem(action, gameData);
  return "effect" in action ? effectProblem(action) : undefined;
};

/** The expressions an action needs, checking it is allowed on this display. */
const actionSources = (
  action: GameAction,
  where: string,
  target: DisplayToCompile,
  gameData: GameData,
): [string, string][] => {
  const problem =
    (action.delayMs ?? 0) < 0
      ? "delayMs can't be negative"
      : (actionProblem(action, target, gameData) ?? (target.cameraCanBeOn ? undefined : needsPlayerProblem(action)));
  if (isDefined(problem)) throw new Error(`${where}: ${problem}`);
  if ("set" in action) return Object.entries(action.set).map(([key, source]) => [source, `${where}.set.${key}`]);
  if ("answer" in action) return [[action.answer, `${where}.answer`]];
  return [];
};

/**
 * Checks that a `start` rule doesn't reset its display: a reset starts the display again, so it would never stop.
 * @throws naming `where` if it does
 */
const checkStartRule = ({ on, do: actions }: GameRule, where: string): void => {
  const a = actions.findIndex((action) => "resetState" in action || "resetChallenge" in action);
  if ("start" in on && a >= 0) {
    throw new Error(`${where}.do[${a}]: a start rule can't reset its own display, as it would start again and again`);
  }
};

/** Every expression source in a rule, with where it is, checking selectors and actions on the way. */
const ruleSources = (
  rule: GameRule,
  where: string,
  target: DisplayToCompile,
  gameData: GameData,
): [string, string][] => {
  const sources: [string, string][] = [
    ...triggerSources(rule.on, `${where}.on`),
    ...(rule.if === undefined ? [] : [[rule.if, `${where}.if`] satisfies [string, string]]),
    ...rule.do.flatMap((action, a) => actionSources(action, `${where}.do[${a}]`, target, gameData)),
  ];
  checkStartRule(rule, where);
  const cameraOnly = target.cameraCanBeOn ? undefined : cameraOnlyRuleProblem(rule);
  if (isDefined(cameraOnly)) throw new Error(`${where}.on: ${cameraOnly}`);
  return sources;
};

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
