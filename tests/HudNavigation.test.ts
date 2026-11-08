import { describe, expect, it } from "vitest";
import { enterStage } from "../src/components/core/logic/GameClickUtils";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import { goTo, goToOptions, resetOptions, resetTo } from "../src/components/core/logic/HudNavigation";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { challenge, game, stage } from "./data/GameBuilders";

/** A game with a title and stages overview; its first stage has two challenges, and its second is locked at first. */
const data = game(
  ["game-overview-title", "game-overview-stages"],
  [stage("one", [challenge("a"), challenge("b")]), stage("two", [challenge("c")]), stage("three", [challenge("d")])],
);
const blank = () => createBlankGameState(data);

/** The labels and whether each can be picked, as `label` or `(label)` for a disabled one. */
const labels = (state: GameState) => goToOptions(state).map(({ label, disabled }) => (disabled ? `(${label})` : label));

describe("goToOptions", () => {
  it("lists the catalogue, the game, its overviews, then each stage followed by its challenges, indented", () => {
    expect(labels(blank())).toEqual([
      "Catalogue (all games)",
      "Game: Test Game",
      "Title: Test Game",
      "Overview: Test Game",
      "Stage: 1",
      "    Challenge: 1.1",
      "    Challenge: 1.2",
      "(🔒 Stage: 2)",
      "(    🔒 Challenge: 2.1)",
      "(🔒 Stage: 3)",
      "(    🔒 Challenge: 3.1)",
    ]);
  });

  it("marks completed stages and challenges, and makes them unpickable", () => {
    const solved = completeChallenge(enterStage(blank(), "one")!, "one", "a");
    expect(labels(solved).slice(4, 7)).toEqual(["Stage: 1", "(    ✓ Challenge: 1.1)", "    Challenge: 1.2"]);
    const done = completeChallenge(solved, "one", "b");
    expect(labels(done)[4]).toBe("(✓ Stage: 1)");
    expect(labels(done)[7]).toBe("Stage: 2");
  });

  it("leaves out the overviews a game doesn't have", () => {
    const state = createBlankGameState(game(["game-overview-stages"], [stage("one", [challenge("a")])]));
    expect(labels(state).slice(0, 4)).toEqual([
      "Catalogue (all games)",
      "Game: Test Game",
      "Overview: Test Game",
      "Stage: 1",
    ]);
  });
});

describe("goTo", () => {
  it("shows the title or the overview, closing any stage", () => {
    const open = enterStage(blank(), "one")!;
    expect(goTo(open, { kind: "title" })!.current).toEqual({ stageId: null, overviewScene: "game-overview-title" });
    expect(goTo(open, { kind: "overview" })!.current).toEqual({
      stageId: null,
      overviewScene: "game-overview-stages",
    });
  });

  it("opens a stage, or a stage showing a chosen challenge", () => {
    expect(goTo(blank(), { kind: "stage", stageId: "one" })!.current.stageId).toBe("one");
    const focused = goTo(blank(), { kind: "challenge", stageId: "one", challengeId: "b" })!;
    expect(focused.session.focusedChallenge).toEqual({ stageId: "one", challengeId: "b" });
  });

  it("can't reach a locked stage, or anywhere outside the game", () => {
    expect(goTo(blank(), { kind: "stage", stageId: "two" })).toBeUndefined();
    expect(goTo(blank(), { kind: "catalogue" })).toBeUndefined();
  });
});

describe("resetOptions and resetTo", () => {
  it("lists each solved challenge, and makes it playable again", () => {
    const solved = completeChallenge(enterStage(blank(), "one")!, "one", "a");
    const options = resetOptions(solved);
    expect(options.map(({ label }) => label)).toEqual(["✓ Challenge: 1.1"]);

    const reset = resetTo(solved, options[0].target);
    expect(reset.stages[0].challengeStates[0].succeeded).toBe(false);
    expect(reset.stages[0].completion).toBe("ready");
    expect(resetOptions(reset)).toEqual([]);
    expect(labels(reset)[5]).toBe("    Challenge: 1.1");
  });

  it("lists nothing before anything is solved", () => {
    expect(resetOptions(blank())).toEqual([]);
  });
});
