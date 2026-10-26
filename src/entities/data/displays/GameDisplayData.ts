import type { GameStageId } from "../GameStageData";
import type { GameDisplayDialogComponentData } from "./GameDisplayDialogComponentData";
import type { GameDisplayScrollComponentData } from "./GameDisplayScrollComponentData";
import type { GameDisplayTemplateComponentData } from "./GameDisplayTemplateComponentData";

/** What an overview display is for: the title screen, the stage selection, or the game-complete screen. */
export type GameOverviewDisplayPurpose = "game-overview-title" | "game-overview-stages" | "game-overview-complete";

/** What a challenge display is for: its title, while in progress, or once completed. */
export type GameChallengeDisplayPurpose = "challenge-title" | "challenge-in-progress" | "challenge-completed";

/** What a stage display is for: `shared` displays sit behind all the stage's challenges. */
export type GameStageDisplayPurpose = "shared";

/** How a display is rendered: from Handlebars `template`s, as a paged `dialog` on the game's image, or as a `scroll` (a dialog on the app's old paper). */
export type GameDisplayComponentType = "template" | "dialog" | "scroll";

/** Any display purpose, at overview, stage or challenge level. */
export type GameDisplayPurpose = GameOverviewDisplayPurpose | GameChallengeDisplayPurpose | GameStageDisplayPurpose;

/** The rendering definition of a display, discriminated by `type`. */
export type GameDisplayComponentData =
  GameDisplayTemplateComponentData | GameDisplayDialogComponentData | GameDisplayScrollComponentData;

/** A way a player can interact with an element in a display. */
export type GameInteraction = "click" | "hand" | "foot" | "body" | "head" | "jump" | "any";

/** The fraction of a body part that must be inside an element when a rule doesn't name a threshold. */
export const DEFAULT_INTERACTION_THRESHOLD = 1;

/** Camera mode settings for one display; unset fields fall back to broader displays. */
export interface GameDisplayCameraData {
  /** Whether camera mode is on while this display shows. */
  enabled?: boolean;
  /** Whether the webcam preview shows while this display shows. */
  preview?: boolean;
}

/** Fields common to every display. */
export interface GameDisplayBase {
  /** When this display is shown. */
  purpose: GameDisplayPurpose;
  /** How this display is rendered. */
  component: GameDisplayComponentData;
  /** Camera mode settings for this display, falling back to broader displays. */
  camera?: GameDisplayCameraData;
}

/** Fields common to every display component. */
export interface GameDisplayComponentBase {
  /** Which kind of component this is. */
  type: GameDisplayComponentType;
  /** Extra values for this display, passed through to its templates as `data` (and `componentData`). */
  data: Record<string, unknown>;
  /** The display's state when it is first shown, and after a reset. Templates and rules see it as `state`. */
  initialState?: Record<string, unknown>;
  /** Whether state returns to `initialState` each time the display is shown. Defaults to false. */
  resetStateOnShow?: boolean;
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

/** A player (or a click) interacting with an element of the display. */
export interface GameInteractTrigger {
  /** The interactions that fire the rule. */
  interact: GameInteraction | GameInteraction[];
  /** CSS selector for the elements, eg. `#door` or `.lava`. */
  target: string;
  /**
   * Camera interactions only: the fraction of the body part that must be inside the element (0–1). Defaults to 1.
   *
   * @minimum 0
   * @maximum 1
   */
  threshold?: number;
  /** Camera interactions only: also fire when the element is covered by another element. Defaults to false. */
  includeCovered?: boolean;
}

/** A CSS animation ending on an element of the display. */
export interface GameAnimationEndTrigger {
  /** The animation's name, as in `@keyframes`. */
  animationEnd: string;
  /** CSS selector for the elements. */
  target: string;
}

/** A CSS transition ending on an element of the display. */
export interface GameTransitionEndTrigger {
  /** The transitioned CSS property, eg. `left`. */
  transitionEnd: string;
  /** CSS selector for the elements. */
  target: string;
}

/** An expression turning from false to true. */
export interface GameWhenTrigger {
  /** Fires on each change from false to true, after any state or game change. */
  when: GameExpressionSource;
}

/** Repeatedly, while the display is shown. */
export interface GameEveryTrigger {
  /** Milliseconds between firings: a number, or an expression re-evaluated each time. */
  every: number | GameExpressionSource;
}

/** Once, some time after the display is shown. */
export interface GameAfterTrigger {
  /** Milliseconds after the display is shown: a number, or an expression. */
  after: number | GameExpressionSource;
}

/** When the display is shown. */
export interface GameStartTrigger {
  /** Always true. */
  start: true;
}

/** What makes a rule fire. */
export type GameTrigger =
  | GameInteractTrigger
  | GameAnimationEndTrigger
  | GameTransitionEndTrigger
  | GameWhenTrigger
  | GameEveryTrigger
  | GameAfterTrigger
  | GameStartTrigger;

/** Sets state keys to the values of expressions, all evaluated against the state before the action. */
export interface GameSetAction {
  /** State key to expression. */
  set: Record<string, GameExpressionSource>;
}

/** Returns the display's state to `initialState`. */
export interface GameResetStateAction {
  /** Always true. */
  resetState: true;
}

/** Marks this display's challenge as solved. Challenge displays only. */
export interface GameCompleteChallengeAction {
  /** Always true. */
  completeChallenge: true;
}

/** Submits an answer to this display's challenge, checked as a typed answer is. Challenge displays only. */
export interface GameAnswerAction {
  /** Expression giving the answer. */
  answer: GameExpressionSource;
}

/** Clears this display's challenge, and the state of its displays. Challenge displays only. */
export interface GameResetChallengeAction {
  /** Always true. */
  resetChallenge: true;
}

/** Opens a stage, unless it is locked or completed. */
export interface GameEnterStageAction {
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
  | GameEnterStageAction;

/** A display shown when no stage is active. */
export interface GameOverviewDisplay extends GameDisplayBase {
  purpose: GameOverviewDisplayPurpose;
}

/** A display shared by all challenges in a stage. */
export interface GameStageDisplay extends GameDisplayBase {
  purpose: GameStageDisplayPurpose;
}

/** A display for one stage of a challenge's lifecycle. */
export interface GameChallengeDisplay extends GameDisplayBase {
  purpose: GameChallengeDisplayPurpose;
}
