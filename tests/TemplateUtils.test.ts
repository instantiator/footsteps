import { describe, expect, it } from "vitest";
import { decorateGameState, parseLines, summariseTemplateSource } from "../src/components/core/logic/TemplateUtils";
import type { GameState } from "../src/entities/state/GameState";
import { simpleGameState } from "./data/SampleGameState";

describe("summariseTemplateSource", () => {
  it("falls back to the id when a typed template has no location", () => {
    expect(summariseTemplateSource({ sourceType: "url" }, "r3")).toBe("url:uid:r3");
  });

  it("names a sourced template by its type and location", () => {
    expect(summariseTemplateSource({ sourceType: "relative", templateSource: "t.hbs" }, "r1")).toBe("relative:t.hbs");
  });

  it("uses the given fallback id, so it is stable across renders, for a template with no location", () => {
    expect(summariseTemplateSource({ sourceType: "embedded", content: "<p/>" }, "r1")).toBe("embedded:uid:r1");
    expect(summariseTemplateSource(undefined, "r2")).toBe("undefined:uid:r2");
  });
});

describe("decorateGameState", () => {
  const state: GameState = {
    ...simpleGameState,
    stages: simpleGameState.stages.map((s, i) => ({
      ...s,
      completion: i === 0 ? "completed" : "ready",
      availability: i === 2 ? "locked" : "unlocked",
    })),
  };
  const decorated = decorateGameState(state);
  const stages = decorated.stages;

  it("flags a completed stage as showCompleted only", () => {
    const { showCompleted, showUnlocked, showLocked } = stages[0];
    expect([showCompleted, showUnlocked, showLocked]).toEqual([true, false, false]);
  });

  it("flags an unlocked, incomplete stage as showUnlocked only", () => {
    const { showCompleted, showUnlocked, showLocked } = stages[1];
    expect([showCompleted, showUnlocked, showLocked]).toEqual([false, true, false]);
  });

  it("flags a locked stage as showLocked only", () => {
    const { showCompleted, showUnlocked, showLocked } = stages[2];
    expect([showCompleted, showUnlocked, showLocked]).toEqual([false, false, true]);
  });

  it("numbers stages from zero and from one, and counts them", () => {
    expect(stages.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(stages.map((s) => s.oneIndex)).toEqual([1, 2, 3]);
    expect(decorated.totalStages).toBe(3);
  });

  it("keeps the rest of the state", () => {
    expect(decorated.gameData).toBe(state.gameData);
    expect(stages[1].stage).toBe(state.stages[1].stage);
  });
});

describe("parseLines", () => {
  it("is empty for undefined or empty text", () => {
    expect(parseLines(undefined)).toEqual([]);
    expect(parseLines("")).toEqual([]);
  });

  it("drops blank lines and trims the rest", () => {
    expect(parseLines("  one \n\n   \n\ttwo\t\nthree")).toEqual(["one", "two", "three"]);
  });
});
