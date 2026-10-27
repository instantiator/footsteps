import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compileGameExpression,
  evaluateGameExpression,
  type ExpressionContext,
} from "../src/components/core/logic/GameExpressionUtils";

const context = (overrides: Partial<ExpressionContext> = {}): ExpressionContext => ({
  state: { score: 3, position: 1, popping: false },
  data: { target: 3, nested: { x: 1 } },
  game: { stages: [{ completion: "completed" }] },
  event: { id: "", interaction: "" },
  ...overrides,
});

const run = (source: string, ctx = context()) =>
  evaluateGameExpression(compileGameExpression(source, "test"), ctx, "test");

describe("GameExpressionUtils", () => {
  afterEach(() => vi.restoreAllMocks());

  it("evaluates arithmetic, comparisons and conditionals over the context", () => {
    expect(run("state.score + 1")).toBe(4);
    expect(run("state.score >= data.target")).toBe(true);
    expect(run("if state.position == 1 then 2 else 1")).toBe(2);
    expect(run("not state.popping")).toBe(true);
  });

  it("supports true and false literals", () => {
    expect(run("true")).toBe(true);
    expect(run("false")).toBe(false);
    expect(run("state.popping == false")).toBe(true);
  });

  it("walks nested objects and arrays", () => {
    expect(run("game.stages.0.completion")).toBe("completed");
    expect(run("data.nested.x")).toBe(1);
  });

  it("reads single-quoted names and tests membership", () => {
    const ctx = context({ state: { "my-key": 5 }, event: { id: "lava-1", interaction: "foot-enter" } });
    expect(run("'state.my-key' + 1", ctx)).toBe(6);
    expect(run('event.id in ("lava-1", "lava-2")', ctx)).toBe(true);
  });

  it("gives undefined for a missing path, rather than an error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(run("state.missing")).toBeUndefined();
    expect(run("state.missing.deeper")).toBeUndefined();
    expect(run("exists(state.missing)")).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  it("cannot reach prototypes or globals", () => {
    for (const source of [
      "state.constructor",
      "state.__proto__",
      "state.toString",
      "data.nested.constructor",
      "constructor",
      "window",
      "globalThis",
      "constructor of state",
    ]) {
      expect(run(source), source).toBeUndefined();
    }
  });

  it("does not run getters", () => {
    const getter = vi.fn(() => 1);
    const state = Object.defineProperty({}, "sneaky", { get: getter, enumerable: true });
    expect(run("state.sneaky", context({ state }))).toBeUndefined();
    expect(getter).not.toHaveBeenCalled();
  });

  it("reports a syntax error at compile time, naming where it is", () => {
    expect(() => compileGameExpression("state.score +", "rules[2].if")).toThrow(/^rules\[2\]\.if: /);
  });

  it("logs a runtime error, naming where it is, and gives undefined", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(evaluateGameExpression(compileGameExpression("1 + true", "x"), context(), "rules[0].set.a")).toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^rules\[0\]\.set\.a: /));
  });
});
