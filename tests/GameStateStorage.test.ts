import { describe, expect, it } from "vitest";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import type { GameData } from "../src/entities/data/GameData";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { clearGameState, loadGameState, saveGameState } from "../src/entities/state/GameStateStorage";
import { simpleGameData } from "./data/SampleGameState";
import { SMALL_GAME_ID, smallGame } from "./data/SmallGame";
import { allSceneScopes } from "../src/components/core/logic/RenderDataUtils";

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
  version: 2,
  gameId: GAME_ID,
  stages: {
    "stage-1": ["stage-1-challenge-1"],
    "stage-2": [],
    "stage-3": [],
  },
  current: { stageId: null, overviewScene: "game-overview-title" },
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
    expect(loaded?.current).toEqual({ stageId: null, overviewScene: "game-overview-title" });
  });

  it("round trips a completed game", () => {
    saveGameState(GAME_ID, complete());

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(loaded?.stages.map((stage) => stage.completion)).toEqual(["completed", "completed", "completed"]);
    expect(loaded?.stages.map((stage) => stage.availability)).toEqual(["unlocked", "unlocked", "unlocked"]);
    expect(loaded?.current.stageId).toBeNull();
  });

  it("keeps a saved current stage", () => {
    const state: GameState = { ...partlyComplete(), current: { stageId: "stage-2", overviewScene: null } };
    saveGameState(GAME_ID, state);

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(loaded?.current).toEqual({ stageId: "stage-2", overviewScene: "game-overview-title" });
  });

  it("ignores a saved current stage that is locked or complete", () => {
    const lockedStage: GameState = {
      ...createBlankGameState(simpleGameData),
      current: { stageId: "stage-3", overviewScene: null },
    };
    saveGameState(GAME_ID, lockedStage);
    expect(loadGameState(GAME_ID, simpleGameData)?.current.stageId).toBeNull();

    const completedStage: GameState = {
      ...partlyComplete(),
      current: { stageId: "stage-1", overviewScene: null },
    };
    saveGameState(GAME_ID, completedStage);
    expect(loadGameState(GAME_ID, simpleGameData)?.current.stageId).toBeNull();
  });

  it("ignores corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("ignores progress from another version", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storedProgress, version: 3 }));

    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("reads progress saved with version 1, before scenes were called scenes, as blank", () => {
    const { current, ...rest } = storedProgress;
    const version1 = {
      ...rest,
      version: 1,
      current: { stageId: current.stageId, overviewDisplay: current.overviewScene },
      displayStates: {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(version1));

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
    const unknownStage = { ...storedProgress, current: { stageId: "no-such-stage", overviewScene: null } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unknownStage));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();

    const unknownOverview = {
      ...storedProgress,
      current: { stageId: null, overviewScene: "game-overview-nope" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unknownOverview));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();

    const noView = { ...storedProgress, current: { stageId: null, overviewScene: null } };
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

describe("GameStateStorage scene states", () => {
  const scope = "challenge:stage-1:stage-1-challenge-1:challenge-in-progress";

  it("round trips scene states, dropping scopes the game doesn't have", () => {
    const state: GameState = {
      ...createBlankGameState(simpleGameData),
      sceneStates: { [scope]: { score: 2, open: true }, "challenge:stage-9:nope:challenge-title": { x: 1 } },
    };
    saveGameState(GAME_ID, state);

    expect(loadGameState(GAME_ID, simpleGameData)?.sceneStates).toEqual({ [scope]: { score: 2, open: true } });
  });

  it("saves version 2 with `sceneStates` and `overviewScene`, and loads both back", () => {
    const blank = createBlankGameState(smallGame);
    const scenesScope = allSceneScopes(smallGame).values().next().value ?? scope;
    const state: GameState = { ...blank, sceneStates: { [scenesScope]: { score: 2 } } };
    saveGameState(SMALL_GAME_ID, state);

    const saved: unknown = JSON.parse(localStorage.getItem(`footsteps:game-state:${SMALL_GAME_ID}`) ?? "null");
    expect(saved).toMatchObject({ version: 2, current: { overviewScene: "game-overview-stages" } });
    const loaded = loadGameState(SMALL_GAME_ID, smallGame);
    expect(loaded?.current.overviewScene).toBe("game-overview-stages");
    expect(loaded?.sceneStates).toEqual({ [scenesScope]: { score: 2 } });
  });

  it("loads progress saved before scenes had state", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedProgress));

    const loaded = loadGameState(GAME_ID, simpleGameData);

    expect(loaded?.stages[0].challengeStates[0].succeeded).toBe(true);
    expect(loaded?.sceneStates).toEqual({});
  });

  it("drops a scene state that isn't an object", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storedProgress, sceneStates: { [scope]: 3 } }));

    expect(loadGameState(GAME_ID, simpleGameData)?.sceneStates).toEqual({});
  });
});
