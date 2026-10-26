import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameRules } from "../src/components/core/GameRulesHook";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import type { DisplayDomEvent } from "../src/components/core/logic/TemplateUtils";
import type { GameData } from "../src/entities/data/GameData";
import type { GameDisplayComponentBase, GameRule } from "../src/entities/data/displays/GameDisplayData";
import { useGameState } from "../src/providers/GameStateHook";
import { challenge, game, stage } from "./data/GameBuilders";
import GameProviders from "./helpers/GameProviders";

const TITLE = "overview:game-overview-title";
const STAGES = "overview:game-overview-stages";
const SHARED = "stage:s1:shared";
const C1 = "challenge:s1:c1:challenge-in-progress";

/** A game with a title, a stages overview, and stage s1 (a shared display and challenges c1, c2, one at a time). */
const rulesGame = (components: Record<string, Partial<GameDisplayComponentBase>> = {}): GameData => {
  const data = game(
    ["game-overview-title", "game-overview-stages"],
    [stage("s1", [challenge("c1"), challenge("c2")], { displays: [{ purpose: "shared", component: scrollWith() }] })],
  );
  const componentFor: Record<string, GameDisplayComponentBase> = {
    [TITLE]: data.displays[0].component,
    [STAGES]: data.displays[1].component,
    [SHARED]: data.stages[0].displays![0].component,
    [C1]: data.stages[0].challenges[0].displays[0].component,
  };
  for (const [scope, extra] of Object.entries(components)) Object.assign(componentFor[scope], extra);
  return data;
};
const scrollWith = () => ({ type: "scroll" as const, contents: [], data: {} });

/** Renders the rules hook in a game, with the game state to read and change. */
const renderRules = (data: GameData) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GameProviders repository={{ games: { g: data } }} gameId="g">
      {children}
    </GameProviders>
  );
  const { result } = renderHook(() => ({ ...useGameRules(), ...useGameState() }), { wrapper });
  const set = (change: (state: ReturnType<typeof useGameState>["gameState"]) => typeof state) =>
    act(() => result.current.setGameState(change));
  const go = (overviewDisplay: "game-overview-title" | "game-overview-stages", stageId: string | null = null) =>
    set((state) => ({ ...state, current: { overviewDisplay, stageId } }));
  return {
    state: () => result.current.gameState,
    displayState: (scope: string) => result.current.gameState.displayStates[scope],
    send: (scope: string, event: DisplayDomEvent) => act(() => result.current.onDisplayEvent(scope, event)),
    set,
    go,
  };
};

/** A template container with a door (holding a knob) and a window, for DOM events. */
const template = () => {
  const root = document.createElement("div");
  root.innerHTML = '<div id="door" class="door"><span id="knob"></span></div><div id="window"></div>';
  document.body.append(root);
  const el = (id: string) => root.querySelector(`#${id}`)!;
  return { root, el };
};

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const count = (key = "n"): GameRule => ({ on: { start: true }, do: [{ set: { [key]: `state.${key} + 1` } }] });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("useGameRules", () => {
  describe("template events", () => {
    const clickRules: GameRule[] = [
      {
        on: { interact: ["click", "hand"], target: ".door" },
        do: [{ set: { opened: "event.id", by: "event.interaction" } }],
      },
      { on: { interact: "hand", target: "#window" }, do: [{ set: { waved: "true" } }] },
      { on: { animationEnd: "pop", target: "#door" }, do: [{ set: { popped: "true" } }] },
      { on: { transitionEnd: "left", target: "#door" }, do: [{ set: { slid: "true" } }] },
    ];

    it("fires click rules whose selector matches the clicked element or an ancestor", () => {
      const rules = renderRules(rulesGame({ [TITLE]: { rules: clickRules } }));
      const { root, el } = template();
      rules.send(TITLE, { kind: "click", target: el("knob"), root });
      expect(rules.displayState(TITLE)).toEqual({ opened: "door", by: "click" });
    });

    it("ignores a click no rule accepts, and an element only the camera can trigger", () => {
      const rules = renderRules(rulesGame({ [STAGES]: { rules: clickRules } }));
      rules.go("game-overview-stages");
      const { root, el } = template();
      rules.send(STAGES, { kind: "click", target: el("window"), root });
      expect(rules.displayState(STAGES)).toBeUndefined();
      expect(rules.state().current.overviewDisplay).toBe("game-overview-stages");
    });

    it("fires animation and transition end rules only for the named animation or property", () => {
      const rules = renderRules(rulesGame({ [TITLE]: { rules: clickRules } }));
      const { root, el } = template();
      rules.send(TITLE, { kind: "animationEnd", name: "fall", target: el("door"), root });
      rules.send(TITLE, { kind: "transitionEnd", name: "top", target: el("door"), root });
      expect(rules.displayState(TITLE)).toBeUndefined();
      rules.send(TITLE, { kind: "animationEnd", name: "pop", target: el("door"), root });
      rules.send(TITLE, { kind: "transitionEnd", name: "left", target: el("door"), root });
      expect(rules.displayState(TITLE)).toEqual({ popped: true, slid: true });
    });

    it("moves on from the title screen on a click that no rule takes", () => {
      const rules = renderRules(rulesGame());
      const { root, el } = template();
      rules.send(TITLE, { kind: "click", target: el("window"), root });
      expect(rules.state().current.overviewDisplay).toBe("game-overview-stages");
    });

    it("ignores events from a display that isn't shown", () => {
      const rules = renderRules(rulesGame({ [STAGES]: { rules: clickRules } }));
      const { root, el } = template();
      rules.send(STAGES, { kind: "click", target: el("door"), root });
      expect(rules.displayState(STAGES)).toBeUndefined();
    });
  });

  describe("start", () => {
    it("fires once each time the display is shown, keeping state while hidden", () => {
      const rules = renderRules(rulesGame({ [STAGES]: { rules: [count()], initialState: { n: 0 } } }));
      rules.go("game-overview-stages");
      expect(rules.displayState(STAGES)).toEqual({ n: 1 });
      rules.set((state) => ({ ...state, displayStates: { ...state.displayStates, other: {} } }));
      expect(rules.displayState(STAGES)).toEqual({ n: 1 });
      rules.go("game-overview-title");
      rules.go("game-overview-stages");
      expect(rules.displayState(STAGES)).toEqual({ n: 2 });
    });

    it("starts from initialState each time a display with resetStateOnShow is shown", () => {
      const rules = renderRules(
        rulesGame({ [STAGES]: { rules: [count()], initialState: { n: 0 }, resetStateOnShow: true } }),
      );
      rules.go("game-overview-stages");
      rules.go("game-overview-title");
      rules.go("game-overview-stages");
      expect(rules.displayState(STAGES)).toEqual({ n: 1 });
    });
  });

  describe("timers", () => {
    const tick = (trigger: GameRule["on"]): GameRule => ({ on: trigger, do: [{ set: { n: "state.n + 1" } }] });

    it("fires an after rule once, after the delay", () => {
      const rules = renderRules(rulesGame({ [TITLE]: { rules: [tick({ after: 1000 })], initialState: { n: 0 } } }));
      advance(999);
      expect(rules.displayState(TITLE)).toBeUndefined();
      advance(1);
      expect(rules.displayState(TITLE)).toEqual({ n: 1 });
      advance(5000);
      expect(rules.displayState(TITLE)).toEqual({ n: 1 });
    });

    it("doesn't fire an after rule once its display is hidden", () => {
      const rules = renderRules(rulesGame({ [TITLE]: { rules: [tick({ after: 1000 })], initialState: { n: 0 } } }));
      advance(500);
      rules.go("game-overview-stages");
      advance(5000);
      expect(rules.displayState(TITLE)).toBeUndefined();
    });

    it("repeats an every rule, re-reading an expression duration each time, until hidden", () => {
      const speedUp: GameRule = { on: { every: "state.ms" }, do: [{ set: { n: "state.n + 1", ms: "state.ms / 2" } }] };
      const rules = renderRules(rulesGame({ [TITLE]: { rules: [speedUp], initialState: { n: 0, ms: 1000 } } }));
      advance(1000);
      expect(rules.displayState(TITLE)).toEqual({ n: 1, ms: 500 });
      advance(500);
      expect(rules.displayState(TITLE)).toEqual({ n: 2, ms: 250 });
      rules.go("game-overview-stages");
      advance(5000);
      expect(rules.displayState(TITLE)).toEqual({ n: 2, ms: 250 });
    });

    it("keeps a stage display's timer running while its challenges move on", () => {
      const rules = renderRules(rulesGame({ [SHARED]: { rules: [tick({ after: 1000 })], initialState: { n: 0 } } }));
      rules.go("game-overview-stages", "s1");
      advance(600);
      rules.set((state) => completeChallenge(state, "s1", "c1"));
      advance(400);
      expect(rules.displayState(SHARED)).toEqual({ n: 1 });
    });

    it("logs and skips a duration that isn't a number", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      renderRules(rulesGame({ [TITLE]: { rules: [tick({ every: '"soon"' })], initialState: { n: 0 } } }));
      expect(error).toHaveBeenCalledWith(expect.stringContaining(`${TITLE} › rules[0].on`));
    });
  });

  describe("when", () => {
    it("fires after a change makes it true, and completes the challenge", () => {
      const rules = renderRules(
        rulesGame({
          [C1]: {
            initialState: { score: 0 },
            rules: [{ on: { when: "state.score >= 2" }, do: [{ completeChallenge: true }] }],
          },
        }),
      );
      rules.go("game-overview-stages", "s1");
      const score = (value: number) =>
        rules.set((state) => ({ ...state, displayStates: { ...state.displayStates, [C1]: { score: value } } }));
      score(1);
      expect(rules.state().stages[0].challengeStates[0].succeeded).toBe(false);
      score(2);
      expect(rules.state().stages[0].challengeStates[0].succeeded).toBe(true);
    });
  });

  describe("selector check", () => {
    it("warns about a selector that matches nothing in the display, once its templates have had time to load", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      renderRules(rulesGame({ [TITLE]: { rules: [{ on: { interact: "click", target: "#nowhere" }, do: [] }] } }));
      expect(warn).not.toHaveBeenCalled();
      advance(2000);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"#nowhere" matches nothing'));
    });
  });
});
