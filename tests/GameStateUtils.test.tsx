import { describe, expect, it } from "vitest";
import {
  completeChallenge,
  getActiveStageStateChallenges,
  getRecommendedStageId,
  resetChallenge,
  validateAnswer,
} from "../src/components/core/logic/GameStateUtils";
import type { GameChallengeData } from "../src/entities/data/GameChallengeData";
import type { GameChallengeSolution } from "../src/entities/data/GameChallengeSolution";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { challenge, game, stage } from "./data/GameBuilders";
import { simpleGameState as gameState_stage1, simpleGameState } from "./data/SampleGameState";

describe("GameState", () => {
  describe("createBlankGameState", () => {
    it("has creates simple game state with sensible defaults", () => {
      expect(gameState_stage1.current.stageId).toBe(null);
      expect(gameState_stage1.stages.every((s) => s.challengeStates.every((c) => c.succeeded === false))).toBe(true);
    });
  });
});

describe("GameStateUtils", () => {
  describe("with simpleGameState", () => {
    describe("getActiveStageStateChallenges", () => {
      describe("at stage 1", () => {
        const simpleGameState_s1: GameState = {
          ...simpleGameState,
          current: { ...simpleGameState.current, stageId: "stage-1" },
        };
        it("retrieves the stage 1 state, and 1 active challenge", () => {
          const { stageState, activeChallengeStates } = getActiveStageStateChallenges(simpleGameState_s1);
          expect(stageState?.stage.id).toBe("stage-1");
          expect(activeChallengeStates?.length).toBe(1);
          expect(activeChallengeStates?.[0].challenge.id).toBe("stage-1-challenge-1");
        });
      });
      describe("at stage 2", () => {
        describe("with chunking of 1", () => {
          const simpleGameState_s2_chunk1: GameState = {
            ...simpleGameState,
            current: { ...simpleGameState.current, stageId: "stage-1" },
            stages: simpleGameState.stages.map((s) => ({
              ...s,
              stage: { ...s.stage, challengeChunking: 1 },
            })),
          };

          it("retrieves the stage 1 state, and 1 active challenge", () => {
            const { stageState, activeChallengeStates } = getActiveStageStateChallenges(simpleGameState_s2_chunk1);
            expect(stageState?.stage.id).toBe("stage-1");
            expect(activeChallengeStates?.length).toBe(1);
            expect(activeChallengeStates?.[0].challenge.id).toBe("stage-1-challenge-1");
          });
        });

        describe("with chunking of 2", () => {
          const simpleGameState_s2_chunk2: GameState = {
            ...simpleGameState,
            current: { ...simpleGameState.current, stageId: "stage-2" },
            stages: simpleGameState.stages.map((s) => ({
              ...s,
              stage: { ...s.stage, challengeChunking: 2 },
            })),
          };

          it("retrieves the stage 2 state, and 2 active challenges", () => {
            const { stageState, activeChallengeStates } = getActiveStageStateChallenges(simpleGameState_s2_chunk2);
            expect(stageState?.stage.id).toBe("stage-2");
            expect(activeChallengeStates?.length).toBe(2);
            expect(activeChallengeStates?.[0].challenge.id).toBe("stage-2-challenge-1");
            expect(activeChallengeStates?.[1].challenge.id).toBe("stage-2-challenge-2");
          });
        });
      });
    });

    describe("completeChallenge", () => {
      const simpleGameState_s1_c1: GameState = {
        ...simpleGameState,
        current: { ...simpleGameState.current, stageId: "stage-1" },
      };
      const simpleGameState_s2_c1 = completeChallenge(simpleGameState_s1_c1, "stage-1", "stage-1-challenge-1");
      const simpleGameState_s2_c2 = completeChallenge(simpleGameState_s2_c1, "stage-2", "stage-2-challenge-1");
      const simpleGameState_s3_c1 = completeChallenge(simpleGameState_s2_c2, "stage-2", "stage-2-challenge-2");
      const simpleGameState_finished = completeChallenge(simpleGameState_s3_c1, "stage-3", "stage-3-challenge-1");

      describe("at stage 1", () => {
        it("completes the sole challenge in stage 1", () => {
          expect(simpleGameState_s2_c1.stages[0].challengeStates[0].succeeded).toBe(true);
          expect(simpleGameState_s2_c1.stages[0].completion).toBe("completed");
        });

        describe("with no stage overview display", () => {
          it("advances to stage 2", () => {
            expect(simpleGameState_s2_c1.current.stageId).toBe("stage-2");
          });
        });
      });

      describe("at stage 2", () => {
        it("completes the first of two challenges in stage 2", () => {
          expect(simpleGameState_s2_c2.stages[1].challengeStates[0].succeeded).toBe(true);
          expect(simpleGameState_s2_c2.stages[1].completion).toBe("partial");
        });

        it("completes the second challenge in stage 2 and advances to stage 3", () => {
          expect(simpleGameState_s3_c1.stages[1].challengeStates[1].succeeded).toBe(true);
          expect(simpleGameState_s3_c1.stages[1].completion).toBe("completed");
          expect(simpleGameState_s3_c1.current.stageId).toBe("stage-3");
        });
      });

      describe("at stage 3", () => {
        it("completes the sole challenge in stage 3 and clears the stage", () => {
          expect(simpleGameState_finished.stages.every((s) => s.completion === "completed")).toBe(true);
          expect(simpleGameState_finished.stages.every((s) => s.challengeStates.every((c) => c.succeeded))).toBe(true);
          expect(simpleGameState_finished.current.stageId).toBe(null);
        });

        it("with a title display but no finale, returns to the title once the game is complete", () => {
          expect(simpleGameState_finished.current.overviewDisplay).toBe("game-overview-title");
        });

        it("with neither a title nor a finale display, shows the stages overview once the game is complete", () => {
          const stagesOnly = { ...simpleGameState.gameData.displays[0], purpose: "game-overview-stages" as const };
          const withoutTitle: GameState = {
            ...simpleGameState_s3_c1,
            gameData: { ...simpleGameState.gameData, displays: [stagesOnly] },
          };
          const finished = completeChallenge(withoutTitle, "stage-3", "stage-3-challenge-1");
          expect(finished.current.overviewDisplay).toBe("game-overview-stages");
        });

        it("shows the finale display once the game is complete, when the game has one", () => {
          const finale = { ...simpleGameState.gameData.displays[0], purpose: "game-overview-complete" as const };
          const withFinale: GameState = {
            ...simpleGameState_s3_c1,
            gameData: { ...simpleGameState.gameData, displays: [...simpleGameState.gameData.displays, finale] },
          };
          const finished = completeChallenge(withFinale, "stage-3", "stage-3-challenge-1");
          expect(finished.current.overviewDisplay).toBe("game-overview-complete");
        });
      });

      it("throws for a stage the game does not have", () => {
        expect(() => completeChallenge(simpleGameState_s1_c1, "no-stage", "stage-1-challenge-1")).toThrow("no-stage");
      });

      it("throws for a challenge the stage does not have", () => {
        expect(() => completeChallenge(simpleGameState_s1_c1, "stage-1", "no-challenge")).toThrow("no-challenge");
      });
    });

    describe("getRecommendedStageId", () => {
      describe("at stage 1 (incomplete)", () => {
        const simpleGameState_s1_c1: GameState = {
          ...simpleGameState,
          current: { ...simpleGameState.current, stageId: "stage-1" },
        };
        it("recommends stage 1", () => {
          const recommendedStageId = getRecommendedStageId(simpleGameState_s1_c1);
          expect(recommendedStageId).toBe("stage-1");
        });
      });

      describe("at stage 1 (complete)", () => {
        const simpleGameState_s1_complete: GameState = {
          ...simpleGameState,
          stages: simpleGameState.stages.map((s) =>
            s.stage.id === "stage-1"
              ? {
                  ...s,
                  completion: "completed",
                }
              : s,
          ),
          current: { ...simpleGameState.current, stageId: "stage-1" },
        };
        it("recommends stage 2", () => {
          const recommendedStageId = getRecommendedStageId(simpleGameState_s1_complete);
          expect(recommendedStageId).toBe("stage-2");
        });
      });
    });
  });
});

/** Three stages: one challenge, two challenges, one challenge. */
const threeStages = (overviews: Parameters<typeof game>[0], config?: Parameters<typeof game>[2]) =>
  createBlankGameState(
    game(
      overviews,
      [stage("s1", [challenge("c1")]), stage("s2", [challenge("c2"), challenge("c3")]), stage("s3", [challenge("c4")])],
      config,
    ),
  );

const atStage = (state: GameState, stageId: string): GameState => ({
  ...state,
  current: { ...state.current, stageId },
});

describe("completeChallenge progression", () => {
  describe("with a stages overview", () => {
    const start = atStage(threeStages(["game-overview-title", "game-overview-stages"]), "s1");

    it("completes the stage, unlocks the next one and returns to the overview", () => {
      const next = completeChallenge(start, "s1", "c1");
      expect(next.stages[0].completion).toBe("completed");
      expect(next.stages[1].availability).toBe("unlocked");
      expect(next.stages[2].availability).toBe("locked");
      expect(next.current.stageId).toBeNull();
    });

    it("marks a stage partial and stays on it when other challenges remain", () => {
      const inS2 = atStage(start, "s2");
      const next = completeChallenge(inS2, "s2", "c2");
      expect(next.stages[1].completion).toBe("partial");
      expect(next.current.stageId).toBe("s2");
    });

    it("does not modify the state it was given", () => {
      const before = structuredClone(start);
      completeChallenge(start, "s1", "c1");
      expect(start).toEqual(before);
    });
  });

  describe("without a stages overview", () => {
    it("moves straight to the recommended next stage", () => {
      const next = completeChallenge(atStage(threeStages(["game-overview-title"]), "s1"), "s1", "c1");
      expect(next.current.stageId).toBe("s2");
    });
  });

  describe("once every stage is complete", () => {
    const finish = (overviews: Parameters<typeof game>[0]) => {
      let state = atStage(threeStages(overviews), "s1");
      for (const [stageId, challengeId] of [
        ["s1", "c1"],
        ["s2", "c2"],
        ["s2", "c3"],
        ["s3", "c4"],
      ]) {
        state = completeChallenge(state, stageId, challengeId);
      }
      return state;
    };

    it.each([
      [["game-overview-title", "game-overview-stages", "game-overview-complete"], "game-overview-complete"],
      [["game-overview-title", "game-overview-stages"], "game-overview-title"],
      [["game-overview-stages"], "game-overview-stages"],
    ] as const)("with overviews %j shows %s", (overviews, expected) => {
      const state = finish([...overviews]);
      expect(state.stages.every((s) => s.completion === "completed")).toBe(true);
      expect(state.current.overviewDisplay).toBe(expected);
    });
  });

  it("advances straight to the next stage when config.autoAdvanceStages is true", () => {
    const state = atStage(
      threeStages(["game-overview-title", "game-overview-stages"], { sequential: true, autoAdvanceStages: true }),
      "s1",
    );
    expect(completeChallenge(state, "s1", "c1").current.stageId).toBe("s2");
  });
});

describe("validateAnswer", () => {
  const withSolution = (solution: Partial<GameChallengeSolution>): GameChallengeData => ({
    ...challenge("c"),
    solution: { answers: ["Hello World"], ...solution },
  });

  it("accepts the answer ignoring case and whitespace by default", () => {
    expect(validateAnswer(withSolution({}), "  hELLo   wORLD ")).toBe(true);
  });

  it("accepts any of several answers", () => {
    const multi = withSolution({ answers: ["one", "two"] });
    expect(validateAnswer(multi, "two")).toBe(true);
    expect(validateAnswer(multi, "three")).toEqual([]);
  });

  it("returns an empty list, not true, on a mismatch", () => {
    expect(validateAnswer(withSolution({}), "goodbye")).toEqual([]);
  });

  it("makes case matter when ignoreCase is false", () => {
    const strict = withSolution({ ignoreCase: false });
    expect(validateAnswer(strict, "hello world")).toEqual([]);
    expect(validateAnswer(strict, "Hello World")).toBe(true);
  });

  it("makes surrounding spaces matter when both trimWhitespace and ignoreWhitespace are false", () => {
    const strict = withSolution({ trimWhitespace: false, ignoreWhitespace: false });
    expect(validateAnswer(strict, " Hello World")).toEqual([]);
    expect(validateAnswer(strict, "Hello World")).toBe(true);
  });

  it("makes inner spaces matter when ignoreWhitespace is false but trimming is on", () => {
    const strict = withSolution({ ignoreWhitespace: false });
    expect(validateAnswer(strict, "HelloWorld")).toEqual([]);
    expect(validateAnswer(strict, "Hello  World")).toEqual([]);
    expect(validateAnswer(strict, "  Hello World  ")).toBe(true);
  });
});

describe("getRecommendedStageId edge cases", () => {
  it("is the first incomplete stage, even if later ones are complete", () => {
    const state = threeStages(["game-overview-title"]);
    const withS3Done: GameState = {
      ...state,
      stages: state.stages.map((s) => (s.stage.id === "s3" ? { ...s, completion: "completed" } : s)),
    };
    expect(getRecommendedStageId(withS3Done)).toBe("s1");
  });

  it("is null when every stage is complete", () => {
    const state = threeStages(["game-overview-title"]);
    const allDone: GameState = { ...state, stages: state.stages.map((s) => ({ ...s, completion: "completed" })) };
    expect(getRecommendedStageId(allDone)).toBeNull();
  });
});

describe("resetChallenge", () => {
  const scope = (challengeId: string) => `challenge:stage-2:${challengeId}:challenge-in-progress`;

  it("unsolves the challenge, recomputes its stage, and clears only its displays' states", () => {
    const solved = completeChallenge(
      completeChallenge(
        completeChallenge(simpleGameState, "stage-1", "stage-1-challenge-1"),
        "stage-2",
        "stage-2-challenge-1",
      ),
      "stage-2",
      "stage-2-challenge-2",
    );
    const state = {
      ...solved,
      displayStates: { [scope("stage-2-challenge-1")]: { n: 1 }, [scope("stage-2-challenge-2")]: { n: 2 } },
    };

    const reset = resetChallenge(state, "stage-2", "stage-2-challenge-1");

    const stage = reset.stages.find((s) => s.stage.id === "stage-2")!;
    expect(stage.challengeStates.map((c) => c.succeeded)).toEqual([false, true]);
    expect(stage.completion).toBe("partial");
    expect(stage.availability).toBe("unlocked");
    expect(reset.displayStates).toEqual({ [scope("stage-2-challenge-2")]: { n: 2 } });
    expect(reset.current).toEqual(state.current);
  });

  it("makes a stage with nothing solved ready again", () => {
    const state = completeChallenge(simpleGameState, "stage-1", "stage-1-challenge-1");
    expect(resetChallenge(state, "stage-1", "stage-1-challenge-1").stages[0].completion).toBe("ready");
  });

  it("throws for a challenge the stage doesn't have", () => {
    expect(() => resetChallenge(simpleGameState, "stage-1", "nope")).toThrow("nope");
  });
});
