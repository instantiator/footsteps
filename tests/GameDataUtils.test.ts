import { describe, expect, it } from "vitest";
import { findChallenge, findChallengeState } from "../src/components/core/logic/GameDataUtils";
import { simpleGameData, simpleGameState } from "./data/SampleGameState";

describe("findChallenge", () => {
  it("finds a challenge by stage and challenge id", () => {
    expect(findChallenge(simpleGameData, "stage-2", "stage-2-challenge-2").id).toBe("stage-2-challenge-2");
  });

  it("throws for an unknown stage", () => {
    expect(() => findChallenge(simpleGameData, "nope", "stage-1-challenge-1")).toThrow("nope");
  });

  it("throws for a challenge that is not in the given stage", () => {
    expect(() => findChallenge(simpleGameData, "stage-1", "stage-2-challenge-1")).toThrow("stage-2-challenge-1");
  });
});

describe("findChallengeState", () => {
  it("finds a challenge state by stage and challenge id", () => {
    const state = findChallengeState(simpleGameState, "stage-2", "stage-2-challenge-1");
    expect(state.challenge.id).toBe("stage-2-challenge-1");
    expect(state.succeeded).toBe(false);
  });

  it("throws for an unknown stage", () => {
    expect(() => findChallengeState(simpleGameState, "nope", "stage-1-challenge-1")).toThrow("nope");
  });

  it("throws for a challenge that is not in the given stage", () => {
    expect(() => findChallengeState(simpleGameState, "stage-1", "stage-2-challenge-1")).toThrow("stage-2-challenge-1");
  });
});
