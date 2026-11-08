import { describe, expect, it } from "vitest";
import { enterStage, leaveTitleScreen } from "../src/components/core/logic/GameClickUtils";
import type { GameOverviewScene } from "../src/entities/data/scenes/GameSceneData";
import type { GameStageState } from "../src/entities/state/GameStageState";
import type { GameState } from "../src/entities/state/GameState";
import { simpleGameState } from "./data/SampleGameState";

const titleScene = simpleGameState.gameData.scenes[0];

const stagesScene: GameOverviewScene = {
  ...titleScene,
  purpose: "game-overview-stages",
};

const onStagesOverview: GameState = {
  ...simpleGameState,
  gameData: { ...simpleGameState.gameData, scenes: [titleScene, stagesScene] },
  current: { stageId: null, overviewScene: "game-overview-stages" },
};

const withStage1 = (changes: Partial<GameStageState>): GameState => ({
  ...onStagesOverview,
  stages: onStagesOverview.stages.map((s) => (s.stage.id === "stage-1" ? { ...s, ...changes } : s)),
});

describe("enterStage", () => {
  it("enters an unlocked stage", () => {
    expect(enterStage(onStagesOverview, "stage-1")?.current.stageId).toBe("stage-1");
  });

  it("does not enter a locked or completed stage", () => {
    expect(enterStage(onStagesOverview, "stage-2")).toBeUndefined();
    expect(enterStage(withStage1({ completion: "completed" }), "stage-1")).toBeUndefined();
  });

  it("throws for a stage the game doesn't have", () => {
    expect(() => enterStage(onStagesOverview, "stage-missing")).toThrow("stage-missing");
  });
});

describe("leaveTitleScreen", () => {
  it("moves from the title screen to the stages overview", () => {
    expect(leaveTitleScreen(simpleGameState)?.current.overviewScene).toBe("game-overview-stages");
  });

  it("does nothing once past the title screen, or during a stage", () => {
    expect(leaveTitleScreen(onStagesOverview)).toBeUndefined();
    const inStage: GameState = { ...simpleGameState, current: { stageId: "stage-1", overviewScene: null } };
    expect(leaveTitleScreen(inStage)).toBeUndefined();
  });
});
