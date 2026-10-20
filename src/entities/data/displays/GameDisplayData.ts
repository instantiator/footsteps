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

/** Fields common to every display. */
export interface GameDisplayBase {
  /** When this display is shown. */
  purpose: GameDisplayPurpose;
  /** How this display is rendered. */
  component: GameDisplayComponentData;
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
  /** Maps ids of elements in the template to the stage id that clicking them enters. */
  clickIdToStageId?: Record<string, string>;
}

/** A display shared by all challenges in a stage. */
export interface GameStageDisplay extends GameDisplayBase {
  purpose: GameStageDisplayPurpose;
}

/** A display for one stage of a challenge's lifecycle. */
export interface GameChallengeDisplay extends GameDisplayBase {
  purpose: GameChallengeDisplayPurpose;
}
