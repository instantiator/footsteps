import type { GameOverviewDisplayPurpose } from "../../../entities/data/displays/GameDisplayData";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { calcOverviewDisplay } from "./RenderDataUtils";

/** The order in which the overview displays are normally shown. */
export const GameOverviewPurposeSequence: GameOverviewDisplayPurpose[] = [
  "game-overview-title",
  "game-overview-stages",
];

/**
 * Moves from the title screen to the stages overview, as any click (or Enter/Space) on the title does.
 * @returns the new state, or undefined if the title screen isn't showing
 */
export const leaveTitleScreen = (state: GameState): GameState | undefined => {
  if (isDefined(state.current.stageId) || calcOverviewDisplay(state)?.purpose !== "game-overview-title")
    return undefined;
  return { ...state, current: { ...state.current, overviewDisplay: "game-overview-stages" } };
};

/**
 * Enters the given stage, unless it is locked or already completed.
 * @returns the new state, or undefined if the stage can't be entered
 * @throws if the game has no such stage
 */
export const enterStage = (state: GameState, stageId: string): GameState | undefined => {
  const stageState = state.stages.find((stage) => stage.stage.id === stageId);
  if (!isDefined(stageState)) {
    throw new Error("Stage state not found for stage id: " + stageId);
  }
  if (stageState.completion === "completed" || stageState.availability === "locked") {
    return undefined;
  }
  return { ...state, current: { ...state.current, stageId } };
};
