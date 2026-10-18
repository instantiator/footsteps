import type { CSSProperties } from "react";
import type { GameOverviewDisplay } from "./displays/GameDisplayData";
import type { CameraModuleData } from "./GameModuleData";
import type { GameStageData } from "./GameStageData";

export type GameId = string;

export interface GameData {
  title: string;
  displays: GameOverviewDisplay[];
  stages: GameStageData[];
  resources?: GameResourceDefinitions;
  modules?: {
    camera?: CameraModuleData;
  };
  config?: {
    sequential: boolean;
    autoAdvanceStages: boolean;
  };
  gameContainerStyle: CSSProperties;
}
export interface GameResourceDefinitions {
  [key: string]: { type: "local" | "relative" | "url"; target: string };
}
