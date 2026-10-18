import { describe, expect, it } from "vitest";
import {
  completeChallenge,
  getActiveStageStateChallenges,
  getRecommendedStageId,
} from "../src/components/core/logic/GameStateUtils";
import type { GameState } from "../src/entities/state/GameState";
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
