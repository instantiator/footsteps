import type { GameRewardData } from "../GameData";
import type { GameStageId } from "../GameStageData";
import type { GameSceneDialogComponentData } from "./GameSceneDialogComponentData";
import type { GameEffect, GamePlayerChoice } from "./GameEffectData";
import type { GameSceneScrollComponentData } from "./GameSceneScrollComponentData";
import type { GameSceneTemplateComponentData } from "./GameSceneTemplateComponentData";

/** What an overview scene is for: the title screen, the stage selection, or the game-complete screen. */
export type GameOverviewScenePurpose = "game-overview-title" | "game-overview-stages" | "game-overview-complete";

/** What a challenge scene is for: its title, while in progress, or once completed. */
export type GameChallengeScenePurpose = "challenge-title" | "challenge-in-progress" | "challenge-completed";

/** What a stage scene is for: `shared` scenes sit behind all the stage's challenges. */
export type GameStageScenePurpose = "shared";

/** How a scene is rendered: from Handlebars `template`s, as a paged `dialog` on the game's image, or as a `scroll` (a dialog on the app's old paper). */
export type GameSceneComponentType = "template" | "dialog" | "scroll";

/** Any scene purpose, at overview, stage or challenge level. */
export type GameScenePurpose = GameOverviewScenePurpose | GameChallengeScenePurpose | GameStageScenePurpose;

/** The rendering definition of a scene, discriminated by `type`. */
export type GameSceneComponentData =
  GameSceneTemplateComponentData | GameSceneDialogComponentData | GameSceneScrollComponentData;

/**
 * Every way a player can interact with an element in a scene. `<part>-enter` fires when a body part comes over the
 * element, and `<part>-exit` when it leaves again. Jumps fire as the player lands: `jump` when they took off from and landed on the element, `jump-from` when
 * they took off from it, and `jump-onto` when they landed on it. `near-enter` fires as a player comes within a distance
 * of the element, and `near-exit` as they leave it.
 */
export const GAME_INTERACTIONS = [
  "click",
  "mouse-enter",
  "mouse-exit",
  "hand-enter",
  "foot-enter",
  "head-enter",
  "body-enter",
  "any-enter",
  "hand-exit",
  "foot-exit",
  "head-exit",
  "body-exit",
  "any-exit",
  "jump",
  "jump-from",
  "jump-onto",
  "near-enter",
  "near-exit",
] as const;

/** A way a player can interact with an element in a scene; see {@link GAME_INTERACTIONS}. */
export type GameInteraction = (typeof GAME_INTERACTIONS)[number];

/** The interactions made with a mouse or other pointer, rather than through the camera. */
export const POINTER_INTERACTIONS = ["click", "mouse-enter", "mouse-exit"] as const;

/** An interaction made with a mouse or other pointer. */
export type PointerInteraction = (typeof POINTER_INTERACTIONS)[number];

/** The fraction of a body part that must be inside an element when a rule doesn't name a threshold. */
export const DEFAULT_INTERACTION_THRESHOLD = 1;

/**
 * How a scene is laid out. `2D`: a full-screen background, the players, and a foreground, with elements' `data-depth`
 * deciding which pass in front of players. `2.5D`: as `2D`, but fitted to the floor the player calibrated: the camera
 * is cropped to the floor, and the view takes the crop's shape, so players' feet stay in view all over the floor.
 */
export type GameSceneMode = "2D" | "2.5D";

/**
 * What stands in for the player. `mouse`: clicks and mouse moves. `camera`: the player's camera cut-out.
 * `mouse-feet`: as `mouse`, but the pointer is also player 1's feet: moving over elements fires foot interactions, and
 * a drag is a jump from where it starts to where it ends.
 */
export type GameAvatarMode = "mouse" | "camera" | "mouse-feet";

/**
 * Avatar settings for one scene. `mode` and `fallback` go together: a scene that sets `mode` doesn't inherit a broader
 * scene's `fallback`. `preview` inherits on its own.
 */
export interface GameSceneAvatarData {
  /** What stands in for the player while this scene shows. */
  mode?: GameAvatarMode;
  /** The mode to use when the camera isn't available. Leaving it out of a `camera` mode means the camera is required. */
  fallback?: Exclude<GameAvatarMode, "camera">;
  /** Whether the webcam preview shows while this scene shows; only in `camera` mode. */
  preview?: boolean;
}

/** Fields common to every scene. */
export interface GameSceneBase {
  /** When this scene is shown. */
  purpose: GameScenePurpose;
  /** How this scene is rendered. */
  component: GameSceneComponentData;
  /** How this scene is laid out, over broader scenes' setting. */
  scene?: GameSceneMode;
  /** What stands in for the player in this scene, over broader scenes' settings. */
  avatar?: GameSceneAvatarData;
  /** Shown in this scene's place first, to help the player get ready for it, until one of its rules finishes it. */
  resetScene?: GameResetScene;
}

/** A scene that helps the player get ready for its parent scene, eg. "Return to the start". */
export interface GameResetScene {
  /** How this scene is rendered, and the rules that finish it (`finishReset`). */
  component: GameSceneComponentData;
  /** How it is laid out, over its parent's setting. */
  scene?: GameSceneMode;
  /** What stands in for the player while it shows, over its parent's settings. */
  avatar?: GameSceneAvatarData;
  /**
   * When it shows: before its parent is first shown since the game loaded (the default), or before every showing.
   * It always shows again when its parent's challenge is reset. A nested reset scene shows with this one.
   */
  showOn?: "first-show" | "every-show";
  /** A reset scene for this reset scene, shown before it. */
  resetScene?: GameResetScene;
}

/** Fields common to every scene component. */
export interface GameSceneComponentBase {
  /** Which kind of component this is. */
  type: GameSceneComponentType;
  /** Extra values for this scene, passed through to its templates as `data` (and `componentData`). */
  data: Record<string, unknown>;
  /** The scene's state when it is first shown, and after a reset. Templates and rules see it as `state`. */
  initialState?: Record<string, unknown>;
  /** Whether state returns to `initialState` each time the scene is shown. Defaults to false. */
  resetStateOnShow?: boolean;
  /** Whether players stay removed when this scene resets. Moving to another scene restores them anyway. Defaults to false. */
  keepRemovedPlayers?: boolean;
  /** What happens in response to events, in order. */
  rules?: GameRule[];
}

/**
 * An expression, eg. `state.score + 1` or `if state.on then 2 else 1`, over `state`, `data`, `game` and `event`.
 * See docs/filtrex.md for the syntax.
 */
export type GameExpressionSource = string;

/** One behaviour: when the trigger fires and the condition holds, apply the actions in order. */
export interface GameRule {
  /** What makes the rule fire. */
  on: GameTrigger;
  /** The rule is skipped when this expression is false. */
  if?: GameExpressionSource;
  /** What the rule does, in order. */
  do: GameAction[];
}

/** A player (or a click) interacting with an element of the scene. */
export interface GameInteractTrigger {
  /** The interactions that fire the rule. */
  interact: GameInteraction | GameInteraction[];
  /**
   * CSS selector for the elements, eg. `#door` or `.lava`. May be left out for `jump` alone, which then fires on every
   * landing; every other interaction needs it, as checked when the game loads.
   */
  target?: string;
  /**
   * `near-enter` and `near-exit` only, which need it: how close counts as near. The distance from the centre of the
   * element to the closest part of the player's silhouette, as a % of the scene's width.
   *
   * @minimum 0
   */
  within?: number;
  /**
   * Camera interactions only: the fraction of the body part that must be inside the element (0–1). Defaults to 1.
   *
   * @minimum 0
   * @maximum 1
   */
  threshold?: number;
  /** Camera interactions only: also fire when the element is covered by another element. Defaults to false. */
  includeCovered?: boolean;
  /**
   * Entering interactions only (`mouse-enter` and the camera's `-enter`s): fire once the player has stayed over the
   * element this many milliseconds, rather than as they arrive.
   *
   * @minimum 0
   */
  holdMs?: number;
}

/** A CSS animation ending on an element of the scene. */
export interface GameAnimationEndTrigger {
  /** The animation's name, as in `@keyframes`. */
  animationEnd: string;
  /** CSS selector for the elements. */
  target: string;
}

/** A CSS transition ending on an element of the scene. */
export interface GameTransitionEndTrigger {
  /** The transitioned CSS property, eg. `left`. */
  transitionEnd: string;
  /** CSS selector for the elements. */
  target: string;
}

/** An effect finishing. Not when ended early by `stop`, or by its scene closing or resetting. */
export interface GameEffectEndTrigger {
  /** The effect's name, eg. `item-fall`. */
  effectEnd: string;
  /** CSS selector: only fire for these elements. Item effects only. Defaults to any element. */
  target?: string;
}

/** An expression turning from false to true, or staying true for a while after that. */
export interface GameWhenTrigger {
  /** Fires on each change from false to true, after any state or game change. */
  when: GameExpressionSource;
  /**
   * Fires once the expression has stayed true this many milliseconds after changing to true, rather than straight
   * away. Turning false, or the scene being hidden, starts it again.
   *
   * @minimum 0
   */
  forMs?: number;
}

/** Repeatedly, while the scene is shown. */
export interface GameEveryTrigger {
  /** Milliseconds between firings: a number, or an expression re-evaluated each time. */
  every: number | GameExpressionSource;
}

/** Once, some time after the scene is shown. */
export interface GameAfterTrigger {
  /** Milliseconds after the scene is shown: a number, or an expression. */
  after: number | GameExpressionSource;
}

/** When the scene is shown. */
export interface GameStartTrigger {
  /** Always true. */
  start: true;
}

/** What makes a rule fire. */
export type GameTrigger =
  | GameInteractTrigger
  | GameAnimationEndTrigger
  | GameTransitionEndTrigger
  | GameEffectEndTrigger
  | GameWhenTrigger
  | GameEveryTrigger
  | GameAfterTrigger
  | GameStartTrigger;

/** What every action can have. */
export interface GameActionBase {
  /**
   * Milliseconds to wait before it happens. Defaults to 0. Later actions don't wait for it.
   *
   * @minimum 0
   */
  delayMs?: number;
}

/** Sets state keys to the values of expressions, all evaluated against the state before the action. */
export interface GameSetAction extends GameActionBase {
  /** State key to expression. */
  set: Record<string, GameExpressionSource>;
}

/** Returns the scene's state to `initialState`. */
export interface GameResetStateAction extends GameActionBase {
  /** Always true. */
  resetState: true;
}

/** Marks this scene's challenge as solved. Challenge scenes only. */
export interface GameCompleteChallengeAction extends GameActionBase {
  /** Always true. */
  completeChallenge: true;
}

/** Submits an answer to this scene's challenge, checked as a typed answer is. Challenge scenes only. */
export interface GameAnswerAction extends GameActionBase {
  /** Expression giving the answer. */
  answer: GameExpressionSource;
}

/** Clears this scene's challenge, and the state of its scenes. Challenge scenes only. */
export interface GameResetChallengeAction extends GameActionBase {
  /** Always true. */
  resetChallenge: true;
}

/** Plays one of the game's sound resources. It doesn't hold up the rule: the rule's other actions carry on. */
export interface GameSoundAction extends GameActionBase {
  /** The resource's name, a key of the game's `resources`. */
  sound: string;
}

/**
 * Shows a celebration, as the game does for a completed stage; not shown to players who prefer reduced motion. It
 * doesn't hold up the rule, and plays alongside any other sounds and rewards.
 */
export interface GameRewardAction extends GameActionBase {
  /** The celebration. */
  reward: GameRewardData;
  /** CSS selector: each burst starts from the centre of a matching element. Defaults to the middle of the game. */
  target?: string;
  /** The players each burst starts from the centre of the body of, instead of `target`. */
  players?: GamePlayerChoice;
}

/** Something a rule plays or shows, rather than changing the game. */
export type GameFeedbackAction = GameSoundAction | GameRewardAction;

/** Finishes this reset scene, revealing the scene it is shown for. Reset scenes only. */
export interface GameFinishResetAction extends GameActionBase {
  /** Always true. */
  finishReset: true;
}

/** Opens a stage, unless it is locked or completed. */
export interface GameEnterStageAction extends GameActionBase {
  /** The stage's id. */
  enterStage: GameStageId;
}

/** Something a rule does. */
export type GameAction =
  | GameSetAction
  | GameResetStateAction
  | GameCompleteChallengeAction
  | GameAnswerAction
  | GameResetChallengeAction
  | GameEnterStageAction
  | GameFinishResetAction
  | GameSoundAction
  | GameRewardAction
  | GameEffect;

/** A scene shown when no stage is active. */
export interface GameOverviewScene extends GameSceneBase {
  purpose: GameOverviewScenePurpose;
}

/** A scene shared by all challenges in a stage. */
export interface GameStageScene extends GameSceneBase {
  purpose: GameStageScenePurpose;
}

/** A scene for one stage of a challenge's lifecycle. */
export interface GameChallengeScene extends GameSceneBase {
  purpose: GameChallengeScenePurpose;
}
