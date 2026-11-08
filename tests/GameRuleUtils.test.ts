import { afterEach, describe, expect, it, vi } from "vitest";
import localRepository from "../public/game-repository.json";
import {
  applyShowResets,
  applyDelayedAction,
  fireRules,
  MAX_WHEN_CHAIN,
  NO_EVENT,
  runWhens,
  whenKey,
  type RuleEnvironment,
  type RuleEvent,
} from "../src/components/core/logic/GameRuleUtils";
import { compileGameRules } from "../src/components/core/logic/GameRuleCompile";
import { startSceneRuns } from "../src/components/core/logic/GameStateUtils";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import type { GameData } from "../src/entities/data/GameData";
import type { GameAction, GameRule } from "../src/entities/data/scenes/GameSceneData";
import type { GameRepository } from "../src/entities/GameRepository";
import { challenge, game, stage } from "./data/GameBuilders";

/** A game whose stages overview, and the challenge in its only stage, have the given rules. */
const gameWithRules = (overviewRules: GameRule[], challengeRules: GameRule[] = []): GameData => {
  const data = game(["game-overview-stages"], [stage("s1", [challenge("c1")])]);
  data.scenes[0].component.rules = overviewRules;
  data.stages[0].challenges[0].scenes[0].component.rules = challengeRules;
  return data;
};

const OVERVIEW = "scenes[0] (game-overview-stages) › rules[0]";
const CHALLENGE = "stages[0] (s1) › challenges[0] (c1) › scenes[0] (challenge-in-progress) › rules[0]";

afterEach(() => vi.restoreAllMocks());

describe("compileGameRules", () => {
  it("compiles every expression in a valid rule set, once per source", () => {
    const expressions = compileGameRules(
      gameWithRules(
        [
          { on: { interact: ["click", "hand-enter"], target: "#door" }, do: [{ enterStage: "s1" }] },
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

  it.each([
    ["resetState", { resetState: true }],
    ["resetChallenge", { resetChallenge: true }],
  ] satisfies [string, GameAction][])("rejects a start rule that does %s, as it would loop", (_, action) => {
    expect(() => compileGameRules(gameWithRules([], [{ on: { start: true }, do: [action] }]))).toThrow(
      `${CHALLENGE}.do[0]: a start rule can't reset`,
    );
  });

  it("rejects a negative delayMs on any action", () => {
    expect(() =>
      compileGameRules(gameWithRules([{ on: { start: true }, do: [{ set: { n: "1" }, delayMs: -1 }] }])),
    ).toThrow(`${OVERVIEW}.do[0]: delayMs can't be negative`);
  });

  it("names the path into a challenge scene", () => {
    const rule: GameRule = { on: { start: true }, do: [{ answer: "+" }] };
    expect(() => compileGameRules(gameWithRules([], [rule]))).toThrow(`${CHALLENGE}.do[0].answer: `);
  });

  it.each([
    ["completeChallenge", { completeChallenge: true }],
    ["answer", { answer: '"x"' }],
    ["resetChallenge", { resetChallenge: true }],
  ] satisfies [string, GameAction][])("rejects %s outside a challenge scene", (name, action) => {
    const rule: GameRule = { on: { start: true }, do: [action] };
    expect(() => compileGameRules(gameWithRules([rule]))).toThrow(
      `${OVERVIEW}.do[0]: ${name} can only be used on a challenge scene`,
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

  it("rejects an interaction that doesn't exist, naming the new name of one that was renamed", () => {
    // Game data from before the rename, as it would arrive from JSON
    const old: GameRule = JSON.parse('{ "on": { "interact": ["click", "hand"], "target": "#door" }, "do": [] }');
    expect(() => compileGameRules(gameWithRules([old]))).toThrow(
      `${OVERVIEW}.on.interact: there is no interaction "hand"; "hand" is now "hand-enter"`,
    );
    const unknown: GameRule = JSON.parse('{ "on": { "interact": "wave", "target": "#door" }, "do": [] }');
    expect(() => compileGameRules(gameWithRules([unknown]))).toThrow('there is no interaction "wave"');
  });

  it.each([
    ["a click", { interact: ["click", "mouse-enter"], target: "#door", holdMs: 500 }, 'not "click"'],
    ["an exit", { interact: "hand-exit", target: "#door", holdMs: 500 }, 'not "hand-exit"'],
    ["a jump", { interact: "jump-onto", target: "#door", holdMs: 500 }, 'not "jump-onto"'],
    ["a negative hold", { interact: "hand-enter", target: "#door", holdMs: -1 }, "can't be negative"],
  ] satisfies [string, GameRule["on"], string][])("rejects holding %s", (_, on, message) => {
    expect(() => compileGameRules(gameWithRules([{ on, do: [] }]))).toThrow(`${OVERVIEW}.on.holdMs: `);
    expect(() => compileGameRules(gameWithRules([{ on, do: [] }]))).toThrow(message);
  });

  it("rejects a sound the game has no resource for, and a negative delay", () => {
    const missing: GameRule = { on: { start: true }, do: [{ sound: "nope" }] };
    expect(() => compileGameRules(gameWithRules([missing]))).toThrow(
      `${OVERVIEW}.do[0]: there is no resource "nope" to play`,
    );
    const early: GameRule = { on: { start: true }, do: [{ reward: { animation: "stars" }, delayMs: -1 }] };
    expect(() => compileGameRules(gameWithRules([early]))).toThrow(`${OVERVIEW}.do[0]: delayMs can't be negative`);
  });

  it("rejects a negative forMs", () => {
    const rule: GameRule = { on: { when: "true", forMs: -1 }, do: [] };
    expect(() => compileGameRules(gameWithRules([rule]))).toThrow(`${OVERVIEW}.on.forMs: a duration can't be negative`);
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

  /** A game whose challenge scene resets on show, with both scenes holding state. */
  const withStates = (current: GameState["current"]): GameState => {
    const data = gameWithRules([]);
    data.stages[0].challenges[0].scenes[0].component.resetStateOnShow = true;
    return {
      ...createBlankGameState(data),
      current,
      sceneStates: { [OVERVIEW_SCOPE]: { n: 1 }, [CHALLENGE_SCOPE]: { n: 2 } },
    };
  };
  const overview = { stageId: null, overviewScene: "game-overview-stages" } as const;
  const inStage = { stageId: "s1", overviewScene: "game-overview-stages" } as const;

  it("resets a flagged scene when it becomes shown", () => {
    expect(applyShowResets(withStates(overview), withStates(inStage)).sceneStates).toEqual({
      [OVERVIEW_SCOPE]: { n: 1 },
    });
  });

  it("keeps the state of a flagged scene that was already shown", () => {
    const next = withStates(inStage);
    expect(applyShowResets(withStates(inStage), next)).toBe(next);
  });

  it("starts a new run of a scene as it shows and as it closes, and not while it stays shown", () => {
    const shown = applyShowResets(withStates(overview), withStates(inStage));
    expect(shown.session.sceneRuns).toEqual({ [CHALLENGE_SCOPE]: 1, [OVERVIEW_SCOPE]: 1 });
    const left = applyShowResets(shown, { ...shown, current: overview });
    const back = applyShowResets(left, { ...left, current: inStage });
    expect(back.session.sceneRuns).toEqual({ [CHALLENGE_SCOPE]: 3, [OVERVIEW_SCOPE]: 3 });
    expect(applyShowResets(back, { ...back })).toEqual(back);
  });

  it("starts a run of what is shown when the game starts", () => {
    expect(applyShowResets(undefined, withStates(overview)).session.sceneRuns).toEqual({ [OVERVIEW_SCOPE]: 1 });
  });

  it("resets a flagged scene that is shown when the game starts", () => {
    expect(applyShowResets(undefined, withStates(inStage)).sceneStates).not.toHaveProperty(CHALLENGE_SCOPE);
  });

  it("keeps the state of a scene without the flag when it becomes shown", () => {
    const next = withStates(overview);
    expect(applyShowResets(withStates(inStage), next).sceneStates).toEqual(next.sceneStates);
  });
});

describe("rule engine", () => {
  const SCOPE = "challenge:s1:c1:challenge-in-progress";
  const OVERVIEW_SCOPE = "overview:game-overview-stages";

  /** A game in stage s1 (of s1, s2), whose c1 scene has the given rules and initial state. */
  const playing = (rules: GameRule[], initialState: Record<string, unknown> = {}) => {
    const data = game(
      ["game-overview-stages"],
      [stage("s1", [challenge("c1"), challenge("c2")]), stage("s2", [challenge("c3")])],
    );
    Object.assign(data.stages[0].challenges[0].scenes[0].component, { rules, initialState });
    const state = createBlankGameState(data);
    return { ...state, current: { ...state.current, stageId: "s1" } };
  };
  const env: RuleEnvironment = { gameId: "g", expressions: new Map() };
  const fireAll = (state: GameState, event: RuleEvent = NO_EVENT, scope = SCOPE) =>
    fireRules(env, state, scope, () => event);
  const stateOf = (state: GameState) => state.sceneStates[SCOPE];
  const solved = (state: GameState, stageIndex = 0, challengeIndex = 0) =>
    state.stages[stageIndex].challengeStates[challengeIndex].succeeded;

  describe("delayed actions", () => {
    const delayedSet: GameRule = {
      on: { start: true },
      do: [{ set: { n: "event.id" }, delayMs: 500 }, { set: { m: "1" } }],
    };
    const fired = () => fireAll(playing([delayedSet]), { id: "door", interaction: "click", player: 0 });
    const runDelayed = (state: GameState, from = fired()) =>
      applyDelayedAction(env, state, from.session.delayedActions[0]);

    it("queues the action rather than applying it, and later actions don't wait", () => {
      const state = fired();
      expect(stateOf(state)).toEqual({ m: 1 });
      expect(state.session.delayedActions).toEqual([
        expect.objectContaining({
          id: 1,
          scope: SCOPE,
          action: delayedSet.do[0],
          event: { id: "door", interaction: "click", player: 0 },
        }),
      ]);
    });

    it("leaves sounds and rewards to the game's own queue", () => {
      const state = fireAll(playing([{ on: { start: true }, do: [{ sound: "pop", delayMs: 500 }] }]));
      expect(state.session.delayedActions).toEqual([]);
      expect(state.session.effects).toHaveLength(1);
    });

    it("works out expressions from the latest state, with the event the rule fired with", () => {
      const later: GameRule = {
        on: { start: true },
        do: [{ set: { sum: "state.n + 1", from: "event.id" }, delayMs: 500 }],
      };
      const state = fireAll(playing([later], { n: 1 }), { id: "door", interaction: "click", player: 0 });
      const changed = { ...state, sceneStates: { [SCOPE]: { n: 10 } } };
      expect(stateOf(applyDelayedAction(env, changed, state.session.delayedActions[0]))).toEqual({
        n: 10,
        sum: 11,
        from: "door",
      });
    });

    it("doesn't check the rule's if again", () => {
      const iffy: GameRule = { on: { start: true }, if: "state.go", do: [{ set: { done: "true" }, delayMs: 500 }] };
      const state = fireAll(playing([iffy], { go: true }));
      const changed = { ...state, sceneStates: { [SCOPE]: { go: false } } };
      expect(stateOf(applyDelayedAction(env, changed, state.session.delayedActions[0]))).toEqual({
        go: false,
        done: true,
      });
    });

    it("does nothing once the scene has closed", () => {
      const state = fired();
      const closed = { ...state, current: { ...state.current, stageId: null } };
      expect(runDelayed(closed)).toBe(closed);
    });

    it("does nothing once the scene has reset", () => {
      const state = fired();
      const again = startSceneRuns(state, [SCOPE]);
      expect(runDelayed(again)).toBe(again);
    });

    it("does nothing once the scene has closed and shown again, as that is a new run", () => {
      const state = fired();
      const closed = applyShowResets(state, { ...state, current: { ...state.current, stageId: null } });
      const back = applyShowResets(closed, { ...closed, current: state.current });
      expect(runDelayed(back)).toBe(back);
    });

    it("doesn't complete a challenge the game has moved on from", () => {
      const late: GameRule = { on: { start: true }, do: [{ completeChallenge: true, delayMs: 500 }] };
      const state = fireAll(playing([late]));
      const moved = { ...state, current: { ...state.current, stageId: null } };
      expect(solved(applyDelayedAction(env, moved, state.session.delayedActions[0]))).toBe(false);
    });
  });

  describe("scene runs", () => {
    const reset = (action: GameAction) => fireAll(playing([{ on: { start: true }, do: [action] }]));

    it("starts a new run on resetState", () => {
      expect(reset({ resetState: true }).session.sceneRuns).toEqual({ [SCOPE]: 1 });
    });

    it("starts a new run of each of the challenge's scenes on resetChallenge", () => {
      expect(reset({ resetChallenge: true }).session.sceneRuns).toEqual({ [SCOPE]: 1 });
    });

    it("includes a challenge's reset scenes, and theirs", () => {
      const state = playing([{ on: { start: true }, do: [{ resetChallenge: true }] }]);
      const component = state.gameData.stages[0].challenges[0].scenes[0].component;
      const resetScene = { component, resetScene: { component } };
      state.gameData.stages[0].challenges[0].scenes[0].resetScene = resetScene;
      const shown = {
        ...state,
        session: { ...state.session, finishedResets: [`${SCOPE}/reset`, `${SCOPE}/reset/reset`] },
      };
      expect(fireAll(shown).session.sceneRuns).toEqual({
        [SCOPE]: 1,
        [`${SCOPE}/reset`]: 1,
        [`${SCOPE}/reset/reset`]: 1,
      });
    });

    it("doesn't start one on a set", () => {
      expect(reset({ set: { n: "1" } }).session.sceneRuns).toEqual({});
    });
  });

  describe("actions", () => {
    it("queues sounds and rewards for the game to play, with growing ids, leaving the rest of the game alone", () => {
      const rule: GameRule = {
        on: { start: true },
        do: [{ sound: "pop" }, { reward: { animation: "stars" }, delayMs: 500 }],
      };
      const state = fireAll(fireAll(playing([rule])));
      expect(state.session.effects).toEqual([
        { id: 1, effect: { sound: "pop" }, scope: SCOPE, event: NO_EVENT },
        { id: 2, effect: { reward: { animation: "stars" }, delayMs: 500 }, scope: SCOPE, event: NO_EVENT },
        { id: 3, effect: { sound: "pop" }, scope: SCOPE, event: NO_EVENT },
        { id: 4, effect: { reward: { animation: "stars" }, delayMs: 500 }, scope: SCOPE, event: NO_EVENT },
      ]);
      expect(state.session.nextEffectId).toBe(5);
      expect(state.sceneStates).toEqual({});
    });

    it("sets every key from the state before the action", () => {
      const state = playing([{ on: { start: true }, do: [{ set: { a: "state.b", b: "state.a" } }] }], {
        a: 1,
        b: 2,
        c: 3,
      });
      expect(stateOf(fireAll(state))).toEqual({ a: 2, b: 1, c: 3 });
    });

    it("applies actions in order, each seeing the last", () => {
      const rule: GameRule = {
        on: { start: true },
        do: [{ set: { n: "state.n + 1" } }, { set: { n: "state.n * 10" } }],
      };
      expect(stateOf(fireAll(playing([rule], { n: 1 })))).toEqual({ n: 20 });
    });

    it("leaves a key unchanged when its expression fails", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const rule: GameRule = { on: { start: true }, do: [{ set: { n: "1 + true", m: "2" } }] };
      expect(stateOf(fireAll(playing([rule], { n: 1 })))).toEqual({ n: 1, m: 2 });
    });

    it("skips a rule whose if is false", () => {
      const rule: GameRule = { on: { start: true }, if: "state.on", do: [{ set: { n: "1" } }] };
      const state = playing([rule], { on: false });
      expect(fireAll(state)).toBe(state);
    });

    it("sees the event in expressions", () => {
      const rule: GameRule = { on: { start: true }, do: [{ set: { hit: "event.id", how: "event.interaction" } }] };
      expect(stateOf(fireAll(playing([rule]), { id: "lava-2", interaction: "foot-enter", player: 0 }))).toEqual({
        hit: "lava-2",
        how: "foot-enter",
      });
    });

    it("resets state to initialState", () => {
      const state = { ...playing([{ on: { start: true }, do: [{ resetState: true }] }], { n: 0 }) };
      const changed = { ...state, sceneStates: { [SCOPE]: { n: 5 } } };
      expect(fireAll(changed).sceneStates).toEqual({});
    });

    it("completes the scene's challenge, once", () => {
      const state = fireAll(playing([{ on: { start: true }, do: [{ completeChallenge: true }] }]));
      expect(solved(state)).toBe(true);
      expect(fireAll(state)).toBe(state);
    });

    it("completes the challenge with a correct answer, and ignores a wrong one", () => {
      const answering = (answer: string) => playing([{ on: { start: true }, do: [{ answer }] }]);
      expect(solved(fireAll(answering('"answer"')))).toBe(true);
      const wrong = answering('"nope"');
      expect(fireAll(wrong)).toBe(wrong);
    });

    it("resets the scene's challenge and its state", () => {
      const rules: GameRule[] = [
        { on: { start: true }, do: [{ set: { n: "1" } }, { completeChallenge: true }, { resetChallenge: true }] },
      ];
      const state = fireAll(playing(rules));
      expect(solved(state)).toBe(false);
      expect(state.sceneStates).toEqual({});
    });

    it("enters an unlocked stage, and leaves a locked one alone", () => {
      const sequential = playing([{ on: { start: true }, do: [{ enterStage: "s2" }] }]);
      expect(fireAll(sequential)).toBe(sequential);

      const open = {
        ...sequential,
        stages: sequential.stages.map((s) => ({ ...s, availability: "unlocked" as const })),
      };
      expect(fireAll(open).current.stageId).toBe("s2");
    });
  });

  describe("fireRules", () => {
    it("fires only the rules pick chooses, in order", () => {
      const rules: GameRule[] = [
        { on: { start: true }, do: [{ set: { log: '"a"' } }] },
        { on: { after: 1 }, do: [{ set: { log: 'state.log + "b"' } }] },
        { on: { start: true }, do: [{ set: { log: 'state.log + "c"' } }] },
      ];
      const fired = fireRules(env, playing(rules), SCOPE, (trigger) => ("start" in trigger ? NO_EVENT : undefined));
      expect(stateOf(fired)).toEqual({ log: "ac" });
    });

    it("does nothing for a scene that isn't shown", () => {
      const state = playing([{ on: { start: true }, do: [{ set: { n: "1" } }] }]);
      expect(fireAll(state, NO_EVENT, OVERVIEW_SCOPE)).toBe(state);
      const hidden = { ...state, current: { ...state.current, stageId: null } };
      expect(fireAll(hidden)).toBe(hidden);
    });
  });

  describe("runWhens", () => {
    const counting = () =>
      playing([{ on: { when: "state.n >= 2" }, do: [{ set: { fired: "state.fired + 1" } }] }], { n: 0, fired: 0 });
    const withN = (state: GameState, n: number) => ({
      ...state,
      sceneStates: { ...state.sceneStates, [SCOPE]: { ...(stateOf(state) ?? { fired: 0 }), n } },
    });

    it("records a when rule seen for the first time without firing it, even if true", () => {
      const state = withN(counting(), 5);
      const result = runWhens(env, state, new Map());
      expect(result.state).toBe(state);
      expect(result.edges.get(whenKey(state, SCOPE, 0))).toBe(true);
    });

    it("begins again after a reset: already true only records, and a later change fires", () => {
      const rules: GameRule[] = [
        { on: { when: "state.n >= 5" }, do: [{ set: { fired: "true" } }] },
        { on: { start: true }, do: [{ resetState: true }] },
      ];
      const before = fireRules(
        env,
        { ...playing(rules, { n: 5 }), sceneStates: { [SCOPE]: { n: 1 } } },
        SCOPE,
        () => undefined,
      );
      const { edges } = runWhens(env, before, new Map());
      const reset = fireRules(env, before, SCOPE, (trigger) => ("start" in trigger ? NO_EVENT : undefined));
      expect(runWhens(env, reset, edges).state).toBe(reset);
    });

    it("fires on false to true, not while it stays true, and again after it has been false", () => {
      let { state, edges } = runWhens(env, counting(), new Map());
      ({ state, edges } = runWhens(env, withN(state, 2), edges));
      expect(stateOf(state)).toMatchObject({ fired: 1 });
      ({ state, edges } = runWhens(env, withN(state, 3), edges));
      expect(stateOf(state)).toMatchObject({ fired: 1 });
      ({ state, edges } = runWhens(env, withN(state, 0), edges));
      ({ state } = runWhens(env, withN(state, 2), edges));
      expect(stateOf(state)).toMatchObject({ fired: 2 });
    });

    it("forgets a hidden scene's rules, so they record afresh when it is shown again", () => {
      const { edges } = runWhens(env, counting(), new Map());
      const hidden = { ...counting(), current: { ...counting().current, stageId: null } };
      const { edges: afterHide } = runWhens(env, hidden, edges);
      expect(afterHide.has(`${SCOPE}#0`)).toBe(false);
      const { state } = runWhens(env, withN(counting(), 2), afterHide);
      expect(stateOf(state)).toMatchObject({ fired: 0 });
    });

    it("follows a chain of when rules that set state", () => {
      const rules: GameRule[] = [
        { on: { when: "state.step == 1" }, do: [{ set: { step: "2" } }] },
        { on: { when: "state.step == 2" }, do: [{ set: { step: "3" } }] },
      ];
      const { edges } = runWhens(env, playing(rules, { step: 0 }), new Map());
      const started = { ...playing(rules, { step: 0 }), sceneStates: { [SCOPE]: { step: 1 } } };
      expect(stateOf(runWhens(env, started, edges).state)).toEqual({ step: 3 });
    });

    it("stops a loop at the cap, names the rules, and doesn't restart it on the next change", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const rules: GameRule[] = [
        { on: { when: "state.x" }, do: [{ set: { x: "false", n: "state.n + 1" } }] },
        { on: { when: "not state.x" }, do: [{ set: { x: "true", n: "state.n + 1" } }] },
      ];
      const { edges } = runWhens(env, playing(rules, { x: false, n: 0 }), new Map());
      const kicked = { ...playing(rules), sceneStates: { [SCOPE]: { x: true, n: 0 } } };

      const looped = runWhens(env, kicked, edges);
      expect(error).toHaveBeenCalledWith(expect.stringContaining(`${SCOPE}#`));
      expect(stateOf(looped.state)).toMatchObject({ n: MAX_WHEN_CHAIN });

      const again = runWhens(env, looped.state, looped.edges);
      expect(again.state).toBe(looped.state);
      expect(error).toHaveBeenCalledTimes(1);
    });
  });
});
