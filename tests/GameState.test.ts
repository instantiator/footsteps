import { describe, expect, it } from "vitest";
import { createBlankGameState } from "../src/entities/state/GameState";
import { challenge, game, stage } from "./data/GameBuilders";

const stages = () => [
  stage("s1", [challenge("c1")]),
  stage("s2", [challenge("c2"), challenge("c3")]),
  stage("s3", [challenge("c4")]),
];

describe("createBlankGameState", () => {
  it("unlocks only the first stage by default", () => {
    const state = createBlankGameState(game(["game-overview-title"], stages()));
    expect(state.stages.map((s) => s.availability)).toEqual(["unlocked", "locked", "locked"]);
  });

  it("unlocks only the first stage when config.sequential is true", () => {
    const state = createBlankGameState(
      game(["game-overview-title"], stages(), { sequential: true, autoAdvanceStages: false }),
    );
    expect(state.stages.map((s) => s.availability)).toEqual(["unlocked", "locked", "locked"]);
  });

  it("unlocks every stage when config.sequential is false", () => {
    const state = createBlankGameState(
      game(["game-overview-title"], stages(), { sequential: false, autoAdvanceStages: false }),
    );
    expect(state.stages.every((s) => s.availability === "unlocked")).toBe(true);
  });

  it("starts everything ready, unsolved and with no attempts, on no stage", () => {
    const state = createBlankGameState(game(["game-overview-title"], stages()));
    expect(state.stages.every((s) => s.completion === "ready")).toBe(true);
    const challengeStates = state.stages.flatMap((s) => s.challengeStates);
    expect(challengeStates).toHaveLength(4);
    expect(challengeStates.every((c) => !c.succeeded && c.attempts.length === 0)).toBe(true);
    expect(state.current.stageId).toBeNull();
  });

  it("starts on the title overview when the game has one", () => {
    const state = createBlankGameState(game(["game-overview-stages", "game-overview-title"], stages()));
    expect(state.current.overviewDisplay).toBe("game-overview-title");
  });

  it("starts on the stages overview when there is no title", () => {
    const state = createBlankGameState(game(["game-overview-stages"], stages()));
    expect(state.current.overviewDisplay).toBe("game-overview-stages");
  });

  it("throws when the game has neither a title nor a stages overview", () => {
    expect(() => createBlankGameState(game(["game-overview-complete"], stages()))).toThrow();
  });
});
