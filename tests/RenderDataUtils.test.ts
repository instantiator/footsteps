import { describe, expect, it } from "vitest";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import {
  calcChallengeDisplay,
  calcChallengeDisplays,
  calcOverviewDisplay,
  calcStageDisplay,
  getLayeredRenderData,
  getRenderMode,
} from "../src/components/core/logic/RenderDataUtils";
import type { DecoratedStageState } from "../src/components/core/logic/TemplateUtils";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { challenge, display, game, stage } from "./data/GameBuilders";

const resources = { logo: "https://example.com/logo.png" };

/** Four single-display challenges in one chunked stage, plus a plain second stage. */
const chunkedGame = (chunking: number, withShared = true) =>
  game(
    ["game-overview-title", "game-overview-stages"],
    [
      stage("s1", [challenge("c1"), challenge("c2"), challenge("c3"), challenge("c4")], {
        challengeChunking: chunking,
        displays: withShared ? [display("shared")] : undefined,
      }),
      stage("s2", [challenge("c5")]),
    ],
  );

const inStage = (state: GameState, stageId: string | null): GameState => ({
  ...state,
  current: { ...state.current, stageId },
});

describe("getRenderMode", () => {
  it("is overview when no stage is current, and stage otherwise", () => {
    const state = createBlankGameState(chunkedGame(1));
    expect(getRenderMode(state)).toBe("overview");
    expect(getRenderMode(inStage(state, "s1"))).toBe("stage");
  });
});

describe("getLayeredRenderData", () => {
  describe("in overview mode", () => {
    const state = createBlankGameState(chunkedGame(1));
    const layers = getLayeredRenderData(state, resources);

    it("has only the overview layer", () => {
      expect(layers.overviewRenderData?.purpose).toBe("game-overview-title");
      expect(layers.stageRenderData).toBeUndefined();
      expect(layers.challengesRenderData).toBeUndefined();
    });

    it("gives templates the display's own data, the resources and the decorated game state", () => {
      const data = layers.overviewRenderData!.templateData;
      expect(data.componentData).toEqual({ marker: "game-overview-title" });
      expect(data.resources).toBe(resources);
      expect(data.challenge).toBeUndefined();
      expect(data.challengeState).toBeUndefined();
      expect(data.gameState.totalStages).toBe(2);
      const stages: DecoratedStageState[] = data.gameState.stages;
      expect(stages.map((s) => s.oneIndex)).toEqual([1, 2]);
    });

    it("belongs to no stage or challenge", () => {
      const overview = layers.overviewRenderData!;
      expect([overview.stageId, overview.challengeId, overview.solution]).toEqual([undefined, undefined, undefined]);
    });
  });

  describe("in stage mode", () => {
    it("has the stage's shared display when it has one", () => {
      const layers = getLayeredRenderData(inStage(createBlankGameState(chunkedGame(1)), "s1"), resources);
      expect(layers.stageRenderData?.purpose).toBe("shared");
      expect(layers.stageRenderData?.stageId).toBe("s1");
      expect(layers.stageRenderData?.templateData.componentData).toEqual({ marker: "shared" });
    });

    it("has no stage layer when the stage has no shared display", () => {
      const layers = getLayeredRenderData(inStage(createBlankGameState(chunkedGame(1, false)), "s1"), resources);
      expect(layers.stageRenderData).toBeUndefined();
    });

    it("renders one challenge per challenge in the first chunk with an unsolved challenge", () => {
      const state = inStage(createBlankGameState(chunkedGame(2)), "s1");
      const ids = (s: GameState) => getLayeredRenderData(s, resources).challengesRenderData?.map((c) => c.challengeId);
      expect(ids(state)).toEqual(["c1", "c2"]);

      const afterFirstChunk = completeChallenge(completeChallenge(state, "s1", "c1"), "s1", "c2");
      expect(ids(inStage(afterFirstChunk, "s1"))).toEqual(["c3", "c4"]);
    });

    it("gives challenge templates the challenge, its state, and where to check answers", () => {
      const state = inStage(createBlankGameState(chunkedGame(1)), "s1");
      const [datum] = getLayeredRenderData(state, resources).challengesRenderData!;
      expect(datum.stageId).toBe("s1");
      expect(datum.challengeId).toBe("c1");
      expect(datum.solution).toEqual({ answers: ["ANSWER"], hints: [] });
      expect(datum.templateData.challenge?.id).toBe("c1");
      expect(datum.templateData.challengeState?.challenge.id).toBe("c1");
      expect(datum.templateData.resources).toBe(resources);
    });

    it("throws when an active challenge has no display", () => {
      const noDisplays = game(["game-overview-title"], [stage("s1", [challenge("c1", [])])]);
      const state = inStage(createBlankGameState(noDisplays), "s1");
      expect(() => getLayeredRenderData(state, resources)).toThrow("c1");
    });
  });
});

describe("calcOverviewDisplay", () => {
  const state = createBlankGameState(chunkedGame(1));

  it("uses the current overview display", () => {
    const current: GameState = { ...state, current: { ...state.current, overviewDisplay: "game-overview-stages" } };
    expect(calcOverviewDisplay(current)?.purpose).toBe("game-overview-stages");
  });

  it("falls back to the title, then the stages overview, when none is current", () => {
    const none: GameState = { ...state, current: { ...state.current, overviewDisplay: null } };
    expect(calcOverviewDisplay(none)?.purpose).toBe("game-overview-title");

    const stagesOnly: GameState = {
      ...none,
      gameData: game(["game-overview-stages"], none.gameData.stages),
    };
    expect(calcOverviewDisplay(stagesOnly)?.purpose).toBe("game-overview-stages");
  });
});

describe("calcStageDisplay", () => {
  it("finds the stage's display by purpose", () => {
    expect(calcStageDisplay(stage("s", [], { displays: [display("shared")] }), "shared")?.purpose).toBe("shared");
  });

  it("is undefined when the stage has no displays", () => {
    expect(calcStageDisplay(stage("s", []), "shared")).toBeUndefined();
  });
});

describe("calcChallengeDisplay", () => {
  const stateOf = (purposes: Parameters<typeof challenge>[1]) =>
    createBlankGameState(game(["game-overview-title"], [stage("s", [challenge("c", purposes)])])).stages[0]
      .challengeStates[0];

  it("prefers the title, then in-progress, then completed", () => {
    expect(
      calcChallengeDisplay(stateOf(["challenge-completed", "challenge-in-progress", "challenge-title"]))?.purpose,
    ).toBe("challenge-title");
    expect(calcChallengeDisplay(stateOf(["challenge-completed", "challenge-in-progress"]))?.purpose).toBe(
      "challenge-in-progress",
    );
    expect(calcChallengeDisplay(stateOf(["challenge-completed"]))?.purpose).toBe("challenge-completed");
  });

  it("is undefined for a challenge with no displays", () => {
    expect(calcChallengeDisplay(stateOf([]))).toBeUndefined();
  });

  // BUG #5 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): a succeeded challenge should show its challenge-completed display; displayPurpose is never updated so the title keeps showing.
  it.skip("shows the completed display once the challenge is succeeded", () => {
    const state = createBlankGameState(
      game(["game-overview-title"], [stage("s", [challenge("c", ["challenge-title", "challenge-completed"])])]),
    );
    const done = completeChallenge(state, "s", "c");
    expect(calcChallengeDisplay(done.stages[0].challengeStates[0])?.purpose).toBe("challenge-completed");
  });
});

describe("calcChallengeDisplays", () => {
  it("maps each challenge state to its display, in order", () => {
    const state = createBlankGameState(
      game(
        ["game-overview-title"],
        [
          stage("s", [
            challenge("a", ["challenge-title"]),
            challenge("b", []),
            challenge("c", ["challenge-completed"]),
          ]),
        ],
      ),
    );
    const displays = calcChallengeDisplays(state.stages[0].challengeStates);
    expect(displays.map((d) => d?.purpose)).toEqual(["challenge-title", undefined, "challenge-completed"]);
  });
});
