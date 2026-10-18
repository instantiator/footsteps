import type { GameOverviewDisplayPurpose } from "../../../entities/data/displays/GameDisplayData";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { calcOverviewDisplay } from "./RenderDataUtils";

export const GameOverviewPurposeSequence: GameOverviewDisplayPurpose[] = [
  "game-overview-title",
  "game-overview-stages",
];

// @ts-expect-error: layerId and targetId will be used in future

export const getNewGameStateForClick = (state: GameState, layerId: string, targetId: string): GameState | undefined => {
  if (!isDefined(state.current.stageId)) {
    const currentOverviewDisplay = calcOverviewDisplay(state);
    if (isDefined(currentOverviewDisplay)) {
      if (isDefined(currentOverviewDisplay.clickIdToStageId)) {
        const stageId = currentOverviewDisplay.clickIdToStageId[targetId];
        if (isDefined(stageId)) {
          const stageState = state.stages.find((stage) => stage.stage.id === stageId);
          if (!isDefined(stageState)) {
            throw new Error("Stage state not found for stage id: " + stageId);
          }
          if (stageState.completion === "completed" || stageState.availability === "locked") {
            return undefined; // do not enter unavailable stages
          }
          return {
            ...state,
            current: {
              ...state.current,
              stageId: stageId,
            },
          };
        }
      }

      if (currentOverviewDisplay.purpose === "game-overview-title") {
        // the title screen was clicked - any click moves to the challenges overview
        return {
          ...state,
          current: {
            ...state.current,
            overviewDisplay: "game-overview-stages",
          },
        };
      }
    }
  }

  // no state changes required
  return undefined;
};
