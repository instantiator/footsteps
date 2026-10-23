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

/** What interacting with an element does, and how the player can do it. */
export interface GameInteractionTarget {
  /** Stage entered by the interaction. */
  stage: GameStageId;
  /** Accepted interactions. Defaults to `["click"]`. */
  interactions?: GameInteraction[];
  /**
   * Fraction of the body part that must be inside the element (0–1).
   *
   * @minimum 0
   * @maximum 1
   */
  threshold?: number;
}

/** The interactions an element accepts when it doesn't name any. */
export const DEFAULT_INTERACTIONS: readonly GameInteraction[] = ["click"];

/** The fraction of a body part that must be inside an element when it doesn't name a threshold. */
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
  /** Extra values for this display, passed through to its templates as `componentData`. */
  data: Record<string, unknown>;
}

/** A display shown when no stage is active. */
export interface GameOverviewDisplay extends GameDisplayBase {
  purpose: GameOverviewDisplayPurpose;
  /**
   * Maps ids of elements in the template to what interacting with them does.
   *
   * NB. The name predates camera interactions: a target lists which interactions it accepts.
   */
  clickIdToStageId?: { [elementId: string]: GameInteractionTarget };
}

/** A display shared by all challenges in a stage. */
export interface GameStageDisplay extends GameDisplayBase {
  purpose: GameStageDisplayPurpose;
}

/** A display for one stage of a challenge's lifecycle. */
export interface GameChallengeDisplay extends GameDisplayBase {
  purpose: GameChallengeDisplayPurpose;
}
