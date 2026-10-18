import { v4 } from "uuid";
import type { GameDisplayTemplateSourceData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameStageState } from "../../../entities/state/GameStageState";
import type { GameState } from "../../../entities/state/GameState";

export type DecoratedGameState = GameState & {
  stages: DecoratedStageState[];
  totalStages: number;
};

export type DecoratedStageState = GameStageState & {
  index: number;
  oneIndex: number;
  showCompleted: boolean;
  showUnlocked: boolean;
  showLocked: boolean;
};

export const decorateGameState = (gameState: GameState): DecoratedGameState => ({
  ...gameState,
  stages: gameState.stages.map((stageState, index) => ({
    ...stageState,
    index,
    oneIndex: index + 1,
    showCompleted: stageState.completion === "completed",
    showUnlocked: stageState.completion !== "completed" && stageState.availability === "unlocked",
    showLocked: stageState.availability === "locked",
  })),
  totalStages: gameState.stages.length,
});

export const summariseTemplateSource = (source: GameDisplayTemplateSourceData | undefined) =>
  `${source?.sourceType ?? "undefined"}:${source?.templateSource ?? `uid:${v4()}`}`;

export const parseLines = (text: string | undefined): string[] => {
  if (!text) {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};
