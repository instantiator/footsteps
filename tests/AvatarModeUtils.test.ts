import { describe, expect, it } from "vitest";
import { canModeFire, cameraModeOf, resolveAvatarMode } from "../src/components/core/logic/AvatarModeUtils";
import { getLayeredRenderData, type LayeredGameSceneRenderData } from "../src/components/core/logic/RenderDataUtils";
import type { GameSceneAvatarData } from "../src/entities/data/scenes/GameSceneData";
import type { GameData } from "../src/entities/data/GameData";
import { createBlankGameState } from "../src/entities/state/GameState";
import { scroll } from "./data/GameBuilders";

/** Avatar settings to give each level of a test game. */
interface AvatarSettings {
  /** The game's `modules.avatar`, or none. */
  game?: GameSceneAvatarData;
  /** The overview scene's settings, or none. */
  overview?: GameSceneAvatarData;
  /** The stage scene's settings, or none. */
  stage?: GameSceneAvatarData;
  /** One per challenge; `undefined` leaves that challenge with no settings. */
  challenges?: (GameSceneAvatarData | undefined)[];
}

/** A one-stage game whose scenes carry the given avatar settings. */
const gameWithAvatar = ({ game, overview, stage, challenges = [undefined] }: AvatarSettings = {}): GameData => ({
  title: "Avatar Game",
  description: "A game for avatar tests.",
  gameContainerStyle: {},
  ...(game && { modules: { avatar: game } }),
  scenes: [{ purpose: "game-overview-stages", component: scroll(), avatar: overview }],
  stages: [
    {
      id: "stage-1",
      scenes: [{ purpose: "shared", component: scroll(), avatar: stage }],
      challengeChunking: challenges.length,
      challenges: challenges.map((avatar, index) => ({
        id: `challenge-${index}`,
        solution: { answers: ["answer"] },
        scenes: [{ purpose: "challenge-in-progress", component: scroll(), avatar }],
      })),
    },
  ],
});

/** Resolves the avatar on the stages overview. */
const onOverview = (settings: AvatarSettings = {}) => {
  const gameData = gameWithAvatar(settings);
  const state = createBlankGameState(gameData);
  return resolveAvatarMode(gameData, getLayeredRenderData(state, {}, "game"));
};

/** Resolves the avatar while stage-1 and its challenges are showing. */
const inStage = (settings: AvatarSettings = {}) => {
  const gameData = gameWithAvatar(settings);
  const state = createBlankGameState(gameData);
  const inStageState = { ...state, current: { stageId: "stage-1", overviewScene: null } };
  const renderData: LayeredGameSceneRenderData = getLayeredRenderData(inStageState, {}, "game");
  return resolveAvatarMode(gameData, renderData);
};

const CAMERA_OR_MOUSE: GameSceneAvatarData = { mode: "camera", fallback: "mouse" };

describe("resolveAvatarMode", () => {
  it("defaults to the mouse, with no preview, when neither the game nor any scene sets it", () => {
    expect(onOverview()).toEqual({ mode: "mouse", fallback: undefined, preview: false });
  });

  it("takes the game's settings when no scene sets them", () => {
    expect(inStage({ game: CAMERA_OR_MOUSE })).toEqual({ mode: "camera", fallback: "mouse", preview: true });
    expect(inStage({ game: { ...CAMERA_OR_MOUSE, preview: false } })).toMatchObject({ preview: false });
  });

  it("inherits from the overview, then the stage, then a challenge, most specific first", () => {
    expect(inStage({ game: { mode: "mouse" }, overview: CAMERA_OR_MOUSE })).toMatchObject({ mode: "camera" });
    expect(inStage({ overview: CAMERA_OR_MOUSE, stage: { mode: "mouse-feet" } })).toMatchObject({
      mode: "mouse-feet",
    });
    expect(inStage({ stage: CAMERA_OR_MOUSE, challenges: [{ mode: "mouse" }] })).toMatchObject({ mode: "mouse" });
  });

  it("takes the fallback with its mode, not from a broader setting", () => {
    expect(inStage({ game: CAMERA_OR_MOUSE, stage: { mode: "camera" } })).toMatchObject({ fallback: undefined });
    expect(inStage({ game: CAMERA_OR_MOUSE, stage: { preview: false } })).toMatchObject({
      mode: "camera",
      fallback: "mouse",
      preview: false,
    });
  });

  it("lets the strongest active challenge win: camera, then mouse-feet, then mouse", () => {
    const both = (a: GameSceneAvatarData, b: GameSceneAvatarData) => inStage({ challenges: [a, b] }).mode;
    expect(both({ mode: "mouse" }, { mode: "mouse-feet" })).toBe("mouse-feet");
    expect(both({ mode: "mouse-feet" }, CAMERA_OR_MOUSE)).toBe("camera");
    expect(both(CAMERA_OR_MOUSE, { mode: "mouse" })).toBe("camera");
  });

  it("lets a challenge turn the preview on over a stage that turns it off, and off when none turns it on", () => {
    expect(
      inStage({ game: CAMERA_OR_MOUSE, stage: { preview: false }, challenges: [{ preview: true }] }),
    ).toMatchObject({
      preview: true,
    });
    expect(
      inStage({ game: CAMERA_OR_MOUSE, stage: { preview: true }, challenges: [{ preview: false }] }),
    ).toMatchObject({
      preview: false,
    });
  });

  it("forces the preview off unless the mode is camera", () => {
    expect(onOverview({ game: { mode: "mouse-feet", preview: true }, overview: { preview: true } })).toMatchObject({
      preview: false,
    });
  });
});

describe("cameraModeOf", () => {
  it("turns camera mode on only for the camera", () => {
    expect(cameraModeOf({ mode: "camera", preview: true })).toEqual({ enabled: true, preview: true });
    expect(cameraModeOf({ mode: "mouse-feet", preview: true })).toEqual({ enabled: false, preview: false });
  });
});

describe("canModeFire", () => {
  it.each([
    ["mouse", "click", true],
    ["mouse", "foot-enter", false],
    ["mouse-feet", "mouse-enter", true],
    ["mouse-feet", "foot-exit", true],
    ["mouse-feet", "any-enter", true],
    ["mouse-feet", "jump-onto", true],
    ["mouse-feet", "hand-enter", false],
    ["mouse-feet", "near-enter", false],
    ["camera", "hand-enter", true],
  ] as const)("%s fires %s: %s", (mode, interaction, fires) => {
    expect(canModeFire(mode, interaction)).toBe(fires);
  });
});
