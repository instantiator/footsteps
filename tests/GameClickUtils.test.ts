import { describe, expect, it } from "vitest";
import { getNewGameStateForClick } from "../src/components/core/logic/GameClickUtils";
import type { GameOverviewDisplay } from "../src/entities/data/displays/GameDisplayData";
import type { GameStageState } from "../src/entities/state/GameStageState";
import type { GameState } from "../src/entities/state/GameState";
import { simpleGameState } from "./data/SampleGameState";

const titleDisplay = simpleGameState.gameData.displays[0];

const stagesDisplay: GameOverviewDisplay = {
  ...titleDisplay,
  purpose: "game-overview-stages",
  clickIdToStageId: { "door-1": "stage-1", "door-2": "stage-2", "door-x": "stage-missing" },
};

const onStagesOverview: GameState = {
  ...simpleGameState,
  gameData: { ...simpleGameState.gameData, displays: [titleDisplay, stagesDisplay] },
  current: { stageId: null, overviewDisplay: "game-overview-stages" },
};

const withStage1 = (changes: Partial<GameStageState>): GameState => ({
  ...onStagesOverview,
  stages: onStagesOverview.stages.map((s) => (s.stage.id === "stage-1" ? { ...s, ...changes } : s)),
});

describe("getNewGameStateForClick", () => {
  it("moves from the title screen to the stages overview on any click", () => {
    const next = getNewGameStateForClick(simpleGameState, "anything");
    expect(next?.current).toEqual({ stageId: null, overviewDisplay: "game-overview-stages" });
  });

  it("enters an unlocked, incomplete stage mapped from the clicked element", () => {
    expect(getNewGameStateForClick(onStagesOverview, "door-1")?.current.stageId).toBe("stage-1");
  });

  it("does not enter a locked stage", () => {
    expect(getNewGameStateForClick(onStagesOverview, "door-2")).toBeUndefined();
  });

  it("does not enter a completed stage", () => {
    expect(getNewGameStateForClick(withStage1({ completion: "completed" }), "door-1")).toBeUndefined();
  });

  it("ignores clicks on unmapped elements of the stages overview", () => {
    expect(getNewGameStateForClick(onStagesOverview, "not-a-door")).toBeUndefined();
  });

  it("throws when a click maps to a stage the game state does not have", () => {
    expect(() => getNewGameStateForClick(onStagesOverview, "door-x")).toThrow("stage-missing");
  });

  it("ignores clicks while a stage is in progress", () => {
    const inStage: GameState = { ...onStagesOverview, current: { stageId: "stage-1", overviewDisplay: null } };
    expect(getNewGameStateForClick(inStage, "door-1")).toBeUndefined();
  });
});
