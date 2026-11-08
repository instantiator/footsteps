import { describe, expect, it } from "vitest";
import { enterStage, goToChallenge, leaveTitleScreen } from "../src/components/core/logic/GameClickUtils";
import { completeChallenge, getActiveStageStateChallenges } from "../src/components/core/logic/GameStateUtils";
import type { GameOverviewScene } from "../src/entities/data/scenes/GameSceneData";
import type { GameStageState } from "../src/entities/state/GameStageState";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { challenge, game, stage } from "./data/GameBuilders";
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

describe("goToChallenge", () => {
  /** A game whose first stage shows three challenges one at a time, and whose second is locked at the start. */
  const data = game(
    ["game-overview-stages"],
    [stage("one", [challenge("a"), challenge("b"), challenge("c")]), stage("two", [challenge("d")])],
  );
  const shown = (state: GameState) =>
    getActiveStageStateChallenges(state).activeChallengeStates?.map((c) => c.challenge.id);

  it("opens the stage showing the chosen challenge, though earlier ones are unsolved", () => {
    const focused = goToChallenge(createBlankGameState(data), "one", "b")!;
    expect(focused.current.stageId).toBe("one");
    expect(shown(focused)).toEqual(["b"]);
  });

  it("goes back to the stage's challenges in order once the chosen one is solved", () => {
    const solved = completeChallenge(goToChallenge(createBlankGameState(data), "one", "b")!, "one", "b");
    expect(solved.session.focusedChallenge).toBeNull();
    expect(shown(solved)).toEqual(["a"]);
  });

  it("forgets the choice when another stage is entered", () => {
    const focused = goToChallenge(createBlankGameState(data), "one", "c")!;
    expect(enterStage(focused, "one")!.session.focusedChallenge).toBeNull();
  });

  it("ignores a choice for a stage that isn't open", () => {
    const focused = goToChallenge(createBlankGameState(data), "one", "c")!;
    const closed: GameState = { ...focused, current: { ...focused.current, stageId: null } };
    expect(shown({ ...closed, current: { ...closed.current, stageId: "one" } })).toEqual(["c"]);
    expect(getActiveStageStateChallenges(closed).activeChallengeStates).toBeNull();
  });

  it("can't go to a solved challenge, or one in a locked stage", () => {
    const solved = completeChallenge(enterStage(createBlankGameState(data), "one")!, "one", "a");
    expect(goToChallenge(solved, "one", "a")).toBeUndefined();
    expect(goToChallenge(createBlankGameState(data), "two", "d")).toBeUndefined();
  });
});
