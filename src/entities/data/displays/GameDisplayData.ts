import type { GameDisplayScrollComponentData } from "./GameDisplayScrollComponentData";
import type { GameDisplayTemplateComponentData } from "./GameDisplayTemplateComponentData";

export type GameOverviewDisplayPurpose = "game-overview-title" | "game-overview-stages" | "game-overview-complete";

export type GameChallengeDisplayPurpose = "challenge-title" | "challenge-in-progress" | "challenge-completed";

export type GameStageDisplayPurpose = "shared";

export type GameDisplayComponentType = "template" | "scroll";

export type GameDisplayPurpose = GameOverviewDisplayPurpose | GameChallengeDisplayPurpose | GameStageDisplayPurpose;

export type GameDisplayComponentData = GameDisplayTemplateComponentData | GameDisplayScrollComponentData;

export interface GameDisplayBase {
  purpose: GameDisplayPurpose;
  component: GameDisplayComponentData;
}

export interface GameDisplayComponentBase {
  type: GameDisplayComponentType;
  data: Record<string, unknown>;
}

export interface GameOverviewDisplay extends GameDisplayBase {
  purpose: GameOverviewDisplayPurpose;
  clickIdToStageId?: Record<string, string>;
}

export interface GameStageDisplay extends GameDisplayBase {
  purpose: GameStageDisplayPurpose;
}

export interface GameChallengeDisplay extends GameDisplayBase {
  purpose: GameChallengeDisplayPurpose;
}
