import { afterEach, describe, expect, it } from "vitest";
import {
  applyShowResets,
  compileGameRules,
  fireRules,
  NO_EVENT,
  type RuleEnvironment,
} from "../src/components/core/logic/GameRuleUtils";
import { getDisplayKey, getLayeredRenderData, getShownDisplays } from "../src/components/core/logic/RenderDataUtils";
import type { GameData } from "../src/entities/data/GameData";
import type { GameResetDisplay, GameRule, GameTrigger } from "../src/entities/data/displays/GameDisplayData";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { clearGameState, loadGameState, saveGameState } from "../src/entities/state/GameStateStorage";
import { challenge, game, scroll, stage } from "./data/GameBuilders";

const ENV: RuleEnvironment = { gameId: "reset-test", expressions: new Map() };

/** The challenge display, and its reset displays. */
const CHALLENGE = "challenge:s1:c1:challenge-in-progress";
const RESET = `${CHALLENGE}/reset`;
const INNER_RESET = `${RESET}/reset`;

/** A rule that finishes its reset display when it starts. */
const FINISH: GameRule = { on: { start: true }, do: [{ finishReset: true }] };

/** Fires a display's `start` rules. */
const start = (state: GameState, scope: string): GameState =>
  fireRules(ENV, state, scope, (trigger: GameTrigger) => ("start" in trigger ? NO_EVENT : undefined));

/** A reset display with the given marker, which finishes when it starts. */
const resetDisplay = (marker: string, extra: Partial<GameResetDisplay> = {}): GameResetDisplay => ({
  component: { ...scroll(marker), rules: [FINISH] },
  ...extra,
});

/** A game whose one challenge has a reset display, and the given rules. */
const gameWithReset = (reset: GameResetDisplay, challengeRules: GameRule[] = []): GameData => {
  const data = game(["game-overview-stages"], [stage("s1", [challenge("c1")])]);
  const display = data.stages[0].challenges[0].displays[0];
  display.component.rules = challengeRules;
  display.resetDisplay = reset;
  return data;
};

const OVERVIEW = { stageId: null, overviewDisplay: "game-overview-stages" } as const;
const IN_STAGE = { stageId: "s1", overviewDisplay: "game-overview-stages" } as const;

/** The game, playing its stage. */
const playing = (data: GameData): GameState => ({ ...createBlankGameState(data), current: IN_STAGE });

/** The scope of the challenge layer's display. */
const shownScope = (state: GameState) => getShownDisplays(state).map(({ scope }) => scope);

describe("reset displays", () => {
  afterEach(() => clearGameState("reset-test"));

  it("show in their parent's place, as part of its challenge, until a rule finishes them", () => {
    const state = playing(gameWithReset(resetDisplay("get-ready")));

    expect(getShownDisplays(state)).toEqual([
      expect.objectContaining({ scope: RESET, stageId: "s1", challengeId: "c1", isReset: true }),
    ]);
    const [render] = getLayeredRenderData(state, {}, "reset-test").challengesRenderData!;
    expect(render.scope).toBe(RESET);
    expect(render.component.data).toEqual({ marker: "get-ready" });

    const finished = start(state, RESET);
    expect(finished.session.finishedResets).toEqual([RESET]);
    expect(shownScope(finished)).toEqual([CHALLENGE]);
  });

  it("keep their parent's rules from running until they finish", () => {
    const started: GameRule = { on: { start: true }, do: [{ set: { started: "true" } }] };
    const state = playing(gameWithReset(resetDisplay("get-ready"), [started]));

    expect(start(state, CHALLENGE)).toBe(state);
    expect(start(start(state, RESET), CHALLENGE).displayStates[CHALLENGE]).toEqual({ started: true });
  });

  it("show a reset display's own reset display first", () => {
    const state = playing(gameWithReset(resetDisplay("outer", { resetDisplay: resetDisplay("inner") })));

    expect(shownScope(state)).toEqual([INNER_RESET]);
    expect(shownScope(start(state, INNER_RESET))).toEqual([RESET]);
    expect(shownScope(start(start(state, INNER_RESET), RESET))).toEqual([CHALLENGE]);
  });

  it("change the display key as they finish, so the reveal fades", () => {
    const state = playing(gameWithReset(resetDisplay("get-ready")));
    const key = (s: GameState) => getDisplayKey(getLayeredRenderData(s, {}, "reset-test"));
    expect(key(start(state, RESET))).not.toBe(key(state));
  });

  it("take their parent's camera settings, with their own over them", () => {
    const data = gameWithReset(resetDisplay("get-ready", { camera: { preview: false } }));
    data.stages[0].challenges[0].displays[0].camera = { enabled: true, preview: true };
    const [render] = getLayeredRenderData(playing(data), {}, "reset-test").challengesRenderData!;
    expect(render.camera).toEqual({ enabled: true, preview: false });
  });

  describe("showing again", () => {
    /** Leaves the stage for the overview, and comes back, as the game state provider sees it. */
    const leaveAndReturn = (state: GameState): GameState => {
      const away = applyShowResets(state, { ...state, current: OVERVIEW });
      return applyShowResets(away, { ...away, current: IN_STAGE });
    };

    it("shows once by default, before the parent's first showing", () => {
      const finished = start(playing(gameWithReset(resetDisplay("get-ready"))), RESET);
      expect(shownScope(leaveAndReturn(finished))).toEqual([CHALLENGE]);
    });

    it("shows before every showing when set to", () => {
      const finished = start(playing(gameWithReset(resetDisplay("get-ready", { showOn: "every-show" }))), RESET);
      expect(shownScope(leaveAndReturn(finished))).toEqual([RESET]);
    });

    it("shows again when the parent's challenge is reset", () => {
      const reset: GameRule = { on: { start: true }, do: [{ resetChallenge: true }] };
      const finished = start(playing(gameWithReset(resetDisplay("get-ready"), [reset])), RESET);
      expect(shownScope(start(finished, CHALLENGE))).toEqual([RESET]);
    });

    it("starts from its initial state each time it shows", () => {
      const data = gameWithReset(resetDisplay("get-ready"));
      const away = { ...createBlankGameState(data), current: OVERVIEW };
      const back = applyShowResets(away, { ...away, current: IN_STAGE, displayStates: { [RESET]: { ready: true } } });
      expect(back.displayStates).not.toHaveProperty(RESET);
    });

    it("shows again when a saved game is loaded, as finishing isn't saved", () => {
      const data = gameWithReset(resetDisplay("get-ready"));
      saveGameState("reset-test", start(playing(data), RESET));
      const loaded = loadGameState("reset-test", data)!;
      expect(loaded.session.finishedResets).toEqual([]);
      expect(shownScope(loaded)).toEqual([RESET]);
    });
  });

  describe("when the game loads", () => {
    it("accepts finishReset on a reset display, including a nested one", () => {
      expect(() =>
        compileGameRules(gameWithReset(resetDisplay("outer", { resetDisplay: resetDisplay("inner") }))),
      ).not.toThrow();
    });

    it("rejects finishReset anywhere else, naming the display", () => {
      expect(() => compileGameRules(gameWithReset(resetDisplay("get-ready"), [FINISH]))).toThrow(
        "challenges[0] (c1) › displays[0] (challenge-in-progress) › rules[0].do[0]: finishReset can only be used on a reset display",
      );
    });

    it("names a reset display's path in its errors", () => {
      const bad: GameResetDisplay = { component: { ...scroll(), rules: [{ on: { when: "1 +" }, do: [] }] } };
      expect(() => compileGameRules(gameWithReset(bad))).toThrow("› resetDisplay › rules[0].on.when");
    });
  });
});
