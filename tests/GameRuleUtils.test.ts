import { describe, expect, it } from "vitest";
import localRepository from "../public/game-repository.json";
import { applyShowResets, compileGameRules } from "../src/components/core/logic/GameRuleUtils";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import type { GameData } from "../src/entities/data/GameData";
import type { GameAction, GameRule } from "../src/entities/data/displays/GameDisplayData";
import type { GameRepository } from "../src/entities/GameRepository";
import { challenge, game, stage } from "./data/GameBuilders";

/** A game whose stages overview, and the challenge in its only stage, have the given rules. */
const gameWithRules = (overviewRules: GameRule[], challengeRules: GameRule[] = []): GameData => {
  const data = game(["game-overview-stages"], [stage("s1", [challenge("c1")])]);
  data.displays[0].component.rules = overviewRules;
  data.stages[0].challenges[0].displays[0].component.rules = challengeRules;
  return data;
};

const OVERVIEW = "displays[0] (game-overview-stages) › rules[0]";
const CHALLENGE = "stages[0] (s1) › challenges[0] (c1) › displays[0] (challenge-in-progress) › rules[0]";

describe("compileGameRules", () => {
  it("compiles every expression in a valid rule set, once per source", () => {
    const expressions = compileGameRules(
      gameWithRules(
        [
          { on: { interact: ["click", "hand"], target: "#door" }, do: [{ enterStage: "s1" }] },
          { on: { every: "state.ms" }, if: "state.on", do: [{ set: { n: "state.n + 1", on: "state.on" } }] },
        ],
        [
          { on: { when: "state.n >= data.target" }, do: [{ completeChallenge: true }] },
          { on: { after: 500 }, do: [{ answer: '"ANSWER"' }, { resetChallenge: true }, { resetState: true }] },
        ],
      ),
    );
    expect([...expressions.keys()].sort()).toEqual(
      ['"ANSWER"', "state.ms", "state.n + 1", "state.n >= data.target", "state.on"].sort(),
    );
  });

  it.each([
    ["if", { on: { start: true }, if: "state +", do: [] }, `${OVERVIEW}.if`],
    ["when", { on: { when: "1 +" }, do: [] }, `${OVERVIEW}.on.when`],
    ["every", { on: { every: "(" }, do: [] }, `${OVERVIEW}.on`],
    ["set", { on: { start: true }, do: [{ set: { a: "1 +" } }] }, `${OVERVIEW}.do[0].set.a`],
  ] satisfies [string, GameRule, string][])("names the path of a bad %s expression", (_, rule, where) => {
    expect(() => compileGameRules(gameWithRules([rule]))).toThrow(`${where}: `);
  });

  it("names the path into a challenge display", () => {
    const rule: GameRule = { on: { start: true }, do: [{ answer: "+" }] };
    expect(() => compileGameRules(gameWithRules([], [rule]))).toThrow(`${CHALLENGE}.do[0].answer: `);
  });

  it.each([
    ["completeChallenge", { completeChallenge: true }],
    ["answer", { answer: '"x"' }],
    ["resetChallenge", { resetChallenge: true }],
  ] satisfies [string, GameAction][])("rejects %s outside a challenge display", (name, action) => {
    const rule: GameRule = { on: { start: true }, do: [action] };
    expect(() => compileGameRules(gameWithRules([rule]))).toThrow(
      `${OVERVIEW}.do[0]: ${name} can only be used on a challenge display`,
    );
  });

  it("rejects entering a stage the game doesn't have", () => {
    const rule: GameRule = { on: { start: true }, do: [{ enterStage: "nope" }] };
    expect(() => compileGameRules(gameWithRules([rule]))).toThrow('there is no stage "nope"');
  });

  it("rejects an invalid selector", () => {
    const rule: GameRule = { on: { interact: "click", target: "#door[" }, do: [] };
    expect(() => compileGameRules(gameWithRules([rule]))).toThrow(`${OVERVIEW}.on.target: `);
  });

  it("rejects a negative duration", () => {
    const rule: GameRule = { on: { after: -1 }, do: [] };
    expect(() => compileGameRules(gameWithRules([rule]))).toThrow("can't be negative");
  });

  it("compiles the rules of every game in the local repository", () => {
    for (const [id, data] of Object.entries((localRepository as GameRepository).games)) {
      expect(() => compileGameRules(data), id).not.toThrow();
    }
  });
});

describe("applyShowResets", () => {
  const OVERVIEW_SCOPE = "overview:game-overview-stages";
  const CHALLENGE_SCOPE = "challenge:s1:c1:challenge-in-progress";

  /** A game whose challenge display resets on show, with both displays holding state. */
  const withStates = (current: GameState["current"]): GameState => {
    const data = gameWithRules([]);
    data.stages[0].challenges[0].displays[0].component.resetStateOnShow = true;
    return {
      ...createBlankGameState(data),
      current,
      displayStates: { [OVERVIEW_SCOPE]: { n: 1 }, [CHALLENGE_SCOPE]: { n: 2 } },
    };
  };
  const overview = { stageId: null, overviewDisplay: "game-overview-stages" } as const;
  const inStage = { stageId: "s1", overviewDisplay: "game-overview-stages" } as const;

  it("resets a flagged display when it becomes shown", () => {
    expect(applyShowResets(withStates(overview), withStates(inStage)).displayStates).toEqual({
      [OVERVIEW_SCOPE]: { n: 1 },
    });
  });

  it("keeps the state of a flagged display that was already shown", () => {
    const next = withStates(inStage);
    expect(applyShowResets(withStates(inStage), next)).toBe(next);
  });

  it("resets a flagged display that is shown when the game starts", () => {
    expect(applyShowResets(undefined, withStates(inStage)).displayStates).not.toHaveProperty(CHALLENGE_SCOPE);
  });

  it("keeps the state of a display without the flag when it becomes shown", () => {
    const next = withStates(overview);
    expect(applyShowResets(withStates(inStage), next)).toBe(next);
  });
});
