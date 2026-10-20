import type { GameDisplayTemplateSourceData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameStageState } from "../../../entities/state/GameStageState";
import type { GameState } from "../../../entities/state/GameState";

/** The game state plus derived values, for Mustache templates (which can't compute them). */
export type DecoratedGameState = GameState & {
  /** Each stage's state, with its template values. */
  stages: DecoratedStageState[];
  /** The number of stages in the game. */
  totalStages: number;
};

/** A stage's state plus derived values, for Mustache templates. */
export type DecoratedStageState = GameStageState & {
  /** Zero-based position in the game's stages. */
  index: number;
  /** One-based position, for display to players. */
  oneIndex: number;
  /** The stage is completed. */
  showCompleted: boolean;
  /** The stage is available to play: unlocked and not yet completed. */
  showUnlocked: boolean;
  /** The stage is locked. */
  showLocked: boolean;
};

/** Adds the derived template values to a game state. */
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

/**
 * A readable, stable id for a template's container: its source type and location, or the
 * given fallback (a React useId(), so it matches between the prerendered HTML and the browser).
 */
export const summariseTemplateSource = (source: GameDisplayTemplateSourceData | undefined, fallbackId: string) =>
  `${source?.sourceType ?? "undefined"}:${source?.templateSource ?? `uid:${fallbackId}`}`;

/** Splits text into its trimmed, non-empty lines. */
export const parseLines = (text: string | undefined): string[] => {
  if (!text) {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};
