import { describe, expect, it } from "vitest";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import type { GameData } from "../src/entities/data/GameData";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { clearGameState, loadGameState, saveGameState } from "../src/entities/state/GameStateStorage";
import { simpleGameData } from "./data/SampleGameState";

const GAME_ID = "simple-game";
const STORAGE_KEY = `footsteps:game-state:${GAME_ID}`;

const stageState = (state: GameState | undefined, stageId: string) =>
  state?.stages.find((stage) => stage.stage.id === stageId);

/** A state with stage 1 complete, stage 2 partly complete, and stage 3 untouched. */
const partlyComplete = (): GameState => {
  const stageOneComplete = completeChallenge(createBlankGameState(simpleGameData), "stage-1", "stage-1-challenge-1");
  return completeChallenge(stageOneComplete, "stage-2", "stage-2-challenge-1");
};

/** A state with every challenge in the simple game complete. */
const complete = (): GameState => {
  const stageTwoComplete = completeChallenge(partlyComplete(), "stage-2", "stage-2-challenge-2");
  return completeChallenge(stageTwoComplete, "stage-3", "stage-3-challenge-1");
};

const storedProgress = {
  version: 1,
  gameId: GAME_ID,
  stages: {
    "stage-1": ["stage-1-challenge-1"],
    "stage-2": [],
    "stage-3": [],
  },
  current: { stageId: null, overviewDisplay: "game-overview-title" },
};

describe("GameStateStorage", () => {
  it("round trips saved progress", () => {
    const state = partlyComplete();
    saveGameState(GAME_ID, state);

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(loaded).toBeDefined();
    expect(loaded?.gameData).toBe(simpleGameData);
    expect(loaded?.stages.map((stage) => stage.completion)).toEqual(["completed", "partial", "ready"]);
    expect(loaded?.stages.map((stage) => stage.availability)).toEqual(["unlocked", "unlocked", "locked"]);
    expect(loaded?.stages[0].challengeStates[0].succeeded).toBe(true);
    expect(loaded?.stages[1].challengeStates[0].succeeded).toBe(true);
    expect(loaded?.current).toEqual(state.current);
  });

  it("loads nothing when no progress has been saved", () => {
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("round trips a blank state without inventing progress", () => {
    saveGameState(GAME_ID, createBlankGameState(simpleGameData));

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(loaded?.stages.map((stage) => stage.completion)).toEqual(["ready", "ready", "ready"]);
    expect(loaded?.stages.map((stage) => stage.availability)).toEqual(["unlocked", "locked", "locked"]);
    expect(loaded?.stages.every((stage) => stage.challengeStates.every((challenge) => !challenge.succeeded))).toBe(
      true,
    );
    expect(loaded?.current).toEqual({ stageId: null, overviewDisplay: "game-overview-title" });
  });

  it("round trips a completed game", () => {
    saveGameState(GAME_ID, complete());

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(loaded?.stages.map((stage) => stage.completion)).toEqual(["completed", "completed", "completed"]);
    expect(loaded?.stages.map((stage) => stage.availability)).toEqual(["unlocked", "unlocked", "unlocked"]);
    expect(loaded?.current.stageId).toBeNull();
  });

  it("keeps a saved current stage", () => {
    const state: GameState = { ...partlyComplete(), current: { stageId: "stage-2", overviewDisplay: null } };
    saveGameState(GAME_ID, state);

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(loaded?.current).toEqual({ stageId: "stage-2", overviewDisplay: "game-overview-title" });
  });

  it("ignores a saved current stage that is locked or complete", () => {
    const lockedStage: GameState = {
      ...createBlankGameState(simpleGameData),
      current: { stageId: "stage-3", overviewDisplay: null },
    };
    saveGameState(GAME_ID, lockedStage);
    expect(loadGameState(GAME_ID, simpleGameData)?.current.stageId).toBeNull();

    const completedStage: GameState = {
      ...partlyComplete(),
      current: { stageId: "stage-1", overviewDisplay: null },
    };
    saveGameState(GAME_ID, completedStage);
    expect(loadGameState(GAME_ID, simpleGameData)?.current.stageId).toBeNull();
  });

  it("ignores corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("ignores progress from another version", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storedProgress, version: 2 }));

    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("ignores progress for another game", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storedProgress, gameId: "other-game" }));

    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("ignores progress whose stages no longer match the game", () => {
    const missingStage = { ...storedProgress, stages: { "stage-1": [], "stage-2": [] } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(missingStage));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();

    const extraStage = { ...storedProgress, stages: { ...storedProgress.stages, "stage-4": [] } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(extraStage));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("ignores progress whose challenges no longer match the game", () => {
    const unknownChallenge = {
      ...storedProgress,
      stages: { ...storedProgress.stages, "stage-2": ["stage-2-challenge-1", "missing-challenge"] },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unknownChallenge));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("ignores duplicate challenge progress", () => {
    const duplicate = {
      ...storedProgress,
      stages: { ...storedProgress.stages, "stage-2": ["stage-2-challenge-1", "stage-2-challenge-1"] },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(duplicate));

    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("ignores an unknown or missing current view", () => {
    const unknownStage = { ...storedProgress, current: { stageId: "no-such-stage", overviewDisplay: null } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unknownStage));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();

    const unknownOverview = {
      ...storedProgress,
      current: { stageId: null, overviewDisplay: "game-overview-nope" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unknownOverview));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();

    const noView = { ...storedProgress, current: { stageId: null, overviewDisplay: null } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(noView));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("unlocks every stage in a game that is not sequential", () => {
    const game: GameData = {
      ...simpleGameData,
      config: { sequential: false, autoAdvanceStages: simpleGameData.config?.autoAdvanceStages ?? false },
    };
    saveGameState(GAME_ID, createBlankGameState(game));

    expect(loadGameState(GAME_ID, game)?.stages.map((stage) => stage.availability)).toEqual([
      "unlocked",
      "unlocked",
      "unlocked",
    ]);
  });

  it("clears saved progress", () => {
    saveGameState(GAME_ID, partlyComplete());
    expect(loadGameState(GAME_ID, simpleGameData)).toBeDefined();

    clearGameState(GAME_ID);

    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("derives completion from challenge progress", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...storedProgress,
        stages: {
          "stage-1": ["stage-1-challenge-1"],
          "stage-2": ["stage-2-challenge-1", "stage-2-challenge-2"],
          "stage-3": [],
        },
      }),
    );

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(stageState(loaded, "stage-1")?.completion).toBe("completed");
    expect(stageState(loaded, "stage-2")?.completion).toBe("completed");
    expect(stageState(loaded, "stage-3")?.completion).toBe("ready");
    expect(loaded?.stages.map((stage) => stage.availability)).toEqual(["unlocked", "unlocked", "unlocked"]);
  });
});
