import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDelayedAction, endAction, fireRules, MAX_EVENT_CHAIN } from "../src/components/core/logic/ActionRuns";
import { startSceneRuns } from "../src/components/core/logic/GameStateUtils";
import { NO_EVENT, type RuleEnvironment, type RuleEvent } from "../src/components/core/logic/RuleActions";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import type { GameRule } from "../src/entities/data/scenes/GameSceneData";
import { challenge, game, scene, scroll, stage } from "./data/GameBuilders";

const SCOPE = "challenge:s1:c1:challenge-in-progress";
const SHARED = "stage:s1:shared";
const env: RuleEnvironment = { gameId: "g", expressions: new Map() };
const DOOR: RuleEvent = { id: "door", interaction: "click", player: 0 };

/** A game in stage s1, whose c1 scene and the stage's shared scene (both shown) have the given rules. */
const playing = (rules: GameRule[], sharedRules: GameRule[] = []): GameState => {
  const shared = { ...scene("shared"), component: { ...scroll(), rules: sharedRules, initialState: { log: "" } } };
  const data = game(["game-overview-stages"], [stage("s1", [challenge("c1")], { scenes: [shared] })]);
  Object.assign(data.stages[0].challenges[0].scenes[0].component, { rules, initialState: { log: "", n: 0 } });
  const state = createBlankGameState(data);
  return { ...state, current: { ...state.current, stageId: "s1" } };
};

/** Fires the scene's start rules, with an event. */
const start = (state: GameState, event: RuleEvent = NO_EVENT, scope = SCOPE) =>
  fireRules(env, state, scope, (trigger) => ("start" in trigger ? event : undefined));

/** A rule that appends to a scene's log as it fires. */
const logs = (on: GameRule["on"], text: string): GameRule => ({
  on,
  do: [{ set: { log: `state.log + "${text}"` } }],
});

const logOf = (state: GameState, scope = SCOPE) => state.sceneStates[scope]?.log ?? "";

afterEach(() => vi.restoreAllMocks());

describe("named actions", () => {
  it("fire actionStart and actionEnd rules in every shown scene, around an action that happens at once", () => {
    const state = start(
      playing(
        [
          { on: { start: true }, do: [{ set: { log: 'state.log + "set;"' }, name: "mark" }] },
          logs({ actionStart: "mark" }, "start;"),
          logs({ actionEnd: "mark" }, "end;"),
        ],
        [logs({ actionEnd: "mark" }, "heard;")],
      ),
    );
    expect(logOf(state)).toBe("start;set;end;");
    expect(logOf(state, SHARED)).toBe("heard;");
    expect(state.session.runningActions).toEqual({});
  });

  it("end a sound only when the game reports it has played, with the event it started with", () => {
    const fired = start(
      playing([
        { on: { start: true }, do: [{ sound: "pop", name: "pop" }] },
        { on: { actionEnd: "pop" }, do: [{ set: { by: "event.id" } }] },
      ]),
      DOOR,
    );
    const [queued] = fired.session.effects;
    expect(queued.actionId).toBeDefined();
    expect(fired.sceneStates[SCOPE]?.by).toBeUndefined();
    const ended = endAction(env, fired, queued.actionId!);
    expect(ended.sceneStates[SCOPE]?.by).toBe("door");
    expect(endAction(env, ended, queued.actionId!)).toBe(ended);
  });

  it("fire actionStart once a delayed action's wait is over, not as its rule fires", () => {
    const fired = start(
      playing([
        { on: { start: true }, do: [{ set: { log: 'state.log + "set;"' }, name: "late", delayMs: 500 }] },
        logs({ actionStart: "late" }, "start;"),
      ]),
    );
    expect(logOf(fired)).toBe("");
    const [delayed] = fired.session.delayedActions;
    expect(logOf(applyDelayedAction(env, fired, delayed))).toBe("start;set;");
  });

  it("end with the element they ended on, which actionEnd targets filter on and event gives", () => {
    const fired = start(
      playing([
        { on: { start: true }, do: [{ effect: "quake", target: ".copy", name: "shake" }] },
        { on: { actionEnd: "shake", target: ".bat" }, do: [{ set: { bat: "event.id" } }] },
        { on: { actionEnd: "shake", target: ".ball" }, do: [{ set: { ball: "event.id" } }] },
      ]),
    );
    const { actionId } = fired.session.visualEffects[0];
    const ended = endAction(env, fired, actionId!, { id: "copy-1", matches: (selector) => selector === ".bat" });
    expect(ended.sceneStates[SCOPE]).toMatchObject({ bat: "copy-1" });
    expect(ended.sceneStates[SCOPE]?.ball).toBeUndefined();
  });

  it("are dropped without ending when their scene resets first", () => {
    const fired = start(
      playing([{ on: { start: true }, do: [{ sound: "pop", name: "pop" }] }, logs({ actionEnd: "pop" }, "end;")]),
    );
    const { actionId } = fired.session.effects[0];
    const reset = startSceneRuns(fired, [SCOPE]);
    expect(reset.session.runningActions).toEqual({});
    expect(logOf(endAction(env, reset, actionId!))).toBe("");
  });
});

describe("raise", () => {
  it("fires raised rules in every shown scene, with the raiser's event", () => {
    const state = start(
      playing(
        [{ on: { start: true }, do: [{ raise: "opened" }] }, logs({ raised: "opened" }, "here;")],
        [{ on: { raised: "opened" }, do: [{ set: { by: "event.id" } }] }],
      ),
      DOOR,
    );
    expect(logOf(state)).toBe("here;");
    expect(state.sceneStates[SHARED]).toMatchObject({ by: "door" });
  });

  it("stops a chain of events that set each other off, logging once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = start(
      playing([
        { on: { start: true }, do: [{ raise: "ping" }] },
        { on: { raised: "ping" }, do: [{ set: { n: "state.n + 1" } }, { raise: "ping" }] },
      ]),
    );
    expect(state.sceneStates[SCOPE]?.n).toBe(MAX_EVENT_CHAIN);
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain(`set each other off ${MAX_EVENT_CHAIN} deep`);
  });
});

describe('the "event" target', () => {
  const shakeEvent: GameRule = { on: { start: true }, do: [{ effect: "quake", target: "event", name: "shake" }] };

  it("means the element the rule fired for", () => {
    const [queued] = start(playing([shakeEvent]), DOOR).session.visualEffects;
    expect(queued.effect).toMatchObject({ target: '[id="door"]' });
  });

  it("ends the action at once, logging, when the rule fired for no element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = start(playing([shakeEvent, logs({ actionEnd: "shake" }, "end;")]));
    expect(state.session.visualEffects).toEqual([]);
    expect(logOf(state)).toBe("end;");
    expect(error.mock.calls[0][0]).toContain('"event" needs an element with an id');
  });
});

describe("groups", () => {
  /** The id of the running action each queued sound reports the end of, in order. */
  const soundIds = (state: GameState) => state.session.effects.map(({ actionId }) => actionId!);

  it("run a series in order, each action starting as the one before ends", () => {
    const fired = start(
      playing([
        {
          on: { start: true },
          do: [{ series: [{ set: { log: '"a"' } }, { sound: "pop" }, { set: { log: 'state.log + "b"' } }] }],
        },
      ]),
    );
    expect(logOf(fired)).toBe("a");
    const ended = endAction(env, fired, soundIds(fired)[0]);
    expect(logOf(ended)).toBe("ab");
    expect(ended.session.runningActions).toEqual({});
  });

  it("end a parallel group with the last of its actions, inside a named series that ends once", () => {
    const fired = start(
      playing([
        {
          on: { start: true },
          do: [
            { series: [{ parallel: [{ sound: "pop" }, { sound: "tick" }] }, { set: { log: '"done;"' } }], name: "all" },
          ],
        },
        logs({ actionEnd: "all" }, "end;"),
      ]),
    );
    const [pop, tick] = soundIds(fired);
    const popped = endAction(env, fired, pop);
    expect(logOf(popped)).toBe("");
    const both = endAction(env, popped, tick);
    expect(logOf(both)).toBe("done;end;");
    expect(both.session.runningActions).toEqual({});
  });

  it("drop the rest of a series, without ending, when its scene resets part way", () => {
    const fired = start(
      playing([
        { on: { start: true }, do: [{ series: [{ sound: "pop" }, { set: { log: '"late"' } }], name: "s" }] },
        logs({ actionEnd: "s" }, "end;"),
      ]),
    );
    const reset = startSceneRuns(fired, [SCOPE]);
    expect(reset.session.runningActions).toEqual({});
    expect(logOf(endAction(env, reset, soundIds(fired)[0]))).toBe("");
  });

  it("carry on past an action that can't be worked out, logging it", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = start(
      playing([
        {
          on: { start: true },
          do: [
            {
              series: [
                { effect: "quake", target: "#a", durationMs: '"soon"' },
                { set: { log: '"a"' }, delayMs: '"later"' },
                { set: { log: 'state.log + "b"' } },
              ],
            },
          ],
        },
      ]),
    );
    expect(logOf(state)).toBe("b");
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("wait out a delay inside a series from that action's turn", () => {
    const fired = start(
      playing([
        { on: { start: true }, do: [{ series: [{ sound: "pop" }, { set: { log: '"late"' }, delayMs: 500 }] }] },
      ]),
    );
    expect(fired.session.delayedActions).toEqual([]);
    const popped = endAction(env, fired, soundIds(fired)[0]);
    const [delayed] = popped.session.delayedActions;
    expect(delayed).toMatchObject({ delayMs: 500 });
    expect(logOf(applyDelayedAction(env, popped, delayed))).toBe("late");
  });

  it("end at once when empty", () => {
    const state = start(
      playing([{ on: { start: true }, do: [{ series: [], name: "none" }] }, logs({ actionEnd: "none" }, "end;")]),
    );
    expect(logOf(state)).toBe("end;");
  });
});
