import { describe, expect, it } from "vitest";
import {
  getInteractionTargets,
  getNewGameStateForClick,
  getNewGameStateForInteraction,
  leaveTitleScreen,
} from "../src/components/core/logic/GameClickUtils";
import type { GameOverviewDisplay } from "../src/entities/data/displays/GameDisplayData";
import type { GameStageState } from "../src/entities/state/GameStageState";
import type { GameState } from "../src/entities/state/GameState";
import { simpleGameState } from "./data/SampleGameState";

const titleDisplay = simpleGameState.gameData.displays[0];

const stagesDisplay: GameOverviewDisplay = {
  ...titleDisplay,
  purpose: "game-overview-stages",
  clickIdToStageId: {
    "door-1": { stage: "stage-1" },
    "door-2": { stage: "stage-2" },
    "door-x": { stage: "stage-missing" },
    "hand-door-x": { stage: "stage-missing", interactions: ["hand"] },
    "hand-door": { stage: "stage-1", interactions: ["hand"] },
    "click-or-hand-door": { stage: "stage-1", interactions: ["click", "hand"] },
  },
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

describe("getNewGameStateForInteraction", () => {
  it("enters the stage a camera interaction names", () => {
    expect(getNewGameStateForInteraction(onStagesOverview, "hand-door", "hand")?.current.stageId).toBe("stage-1");
  });

  it("ignores an interaction the target does not accept", () => {
    expect(getNewGameStateForInteraction(onStagesOverview, "hand-door", "click")).toBeUndefined();
    expect(getNewGameStateForInteraction(onStagesOverview, "hand-door", "foot")).toBeUndefined();
  });

  it("accepts a click when the target lists click alongside camera interactions", () => {
    expect(getNewGameStateForInteraction(onStagesOverview, "click-or-hand-door", "click")?.current.stageId).toBe(
      "stage-1",
    );
  });

  it("ignores camera interactions on elements with no target, including the title screen", () => {
    expect(getNewGameStateForInteraction(onStagesOverview, "not-a-door", "hand")).toBeUndefined();
    expect(getNewGameStateForInteraction(simpleGameState, "anything", "hand")).toBeUndefined();
  });

  it("still moves on from the title screen on a click", () => {
    expect(getNewGameStateForInteraction(simpleGameState, "anything", "click")?.current.overviewDisplay).toBe(
      "game-overview-stages",
    );
  });

  it("does not enter a locked or completed stage", () => {
    const locked = withStage1({ availability: "locked" });
    expect(getNewGameStateForInteraction(locked, "hand-door", "hand")).toBeUndefined();
    const completed = withStage1({ completion: "completed" });
    expect(getNewGameStateForInteraction(completed, "hand-door", "hand")).toBeUndefined();
  });

  it("throws when an interaction maps to a stage the game state does not have", () => {
    expect(() => getNewGameStateForInteraction(onStagesOverview, "hand-door-x", "hand")).toThrow("stage-missing");
  });
});

describe("getInteractionTargets", () => {
  it("returns the overview display's targets", () => {
    expect(getInteractionTargets(onStagesOverview)).toBe(stagesDisplay.clickIdToStageId);
  });

  it("returns no targets while a stage is in progress", () => {
    const inStage: GameState = { ...onStagesOverview, current: { stageId: "stage-1", overviewDisplay: null } };
    expect(getInteractionTargets(inStage)).toEqual({});
  });
});

describe("leaveTitleScreen", () => {
  it("moves from the title screen to the stages overview", () => {
    expect(leaveTitleScreen(simpleGameState)?.current.overviewDisplay).toBe("game-overview-stages");
  });

  it("does nothing once past the title screen, or during a stage", () => {
    expect(leaveTitleScreen(onStagesOverview)).toBeUndefined();
    const inStage: GameState = { ...simpleGameState, current: { stageId: "stage-1", overviewDisplay: null } };
    expect(leaveTitleScreen(inStage)).toBeUndefined();
  });
});
