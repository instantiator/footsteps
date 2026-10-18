import type { GameOverviewDisplayPurpose } from "../../../entities/data/displays/GameDisplayData";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { calcOverviewDisplay } from "./RenderDataUtils";

export const GameOverviewPurposeSequence: GameOverviewDisplayPurpose[] = [
  "game-overview-title",
  "game-overview-stages",
];

/**
 * Works out the game state after a click on an overview display element.
 * @returns the new state, or undefined if the click changes nothing
 */
export const getNewGameStateForClick = (state: GameState, targetId: string): GameState | undefined => {
  if (isDefined(state.current.stageId)) return undefined;

  const overviewDisplay = calcOverviewDisplay(state);
  if (!isDefined(overviewDisplay)) return undefined;

  const stageId = overviewDisplay.clickIdToStageId?.[targetId];
  if (isDefined(stageId)) return enterStage(state, stageId);

  if (overviewDisplay.purpose === "game-overview-title") {
    // the title screen was clicked - any click moves to the challenges overview
    return { ...state, current: { ...state.current, overviewDisplay: "game-overview-stages" } };
  }
  return undefined;
};

/** Enters the given stage, unless it is locked or already completed. */
const enterStage = (state: GameState, stageId: string): GameState | undefined => {
  const stageState = state.stages.find((stage) => stage.stage.id === stageId);
  if (!isDefined(stageState)) {
    throw new Error("Stage state not found for stage id: " + stageId);
  }
  if (stageState.completion === "completed" || stageState.availability === "locked") {
    return undefined;
  }
  return { ...state, current: { ...state.current, stageId } };
};
