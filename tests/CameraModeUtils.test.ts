import { describe, expect, it } from "vitest";
import { resolveCameraMode } from "../src/components/core/logic/CameraModeUtils";
import { getLayeredRenderData, type LayeredGameSceneRenderData } from "../src/components/core/logic/RenderDataUtils";
import type { GameSceneCameraData } from "../src/entities/data/scenes/GameSceneData";
import type { GameData } from "../src/entities/data/GameData";
import type { CameraModuleData } from "../src/entities/data/GameModuleData";
import { createBlankGameState } from "../src/entities/state/GameState";
import { scroll } from "./data/GameBuilders";

/** Camera settings to give each level of a test game. */
interface CameraSettings {
  /** The game's camera module, or none. */
  game?: CameraModuleData;
  /** The overview scene's settings, or none. */
  overview?: GameSceneCameraData;
  /** The stage scene's settings, or none. */
  stage?: GameSceneCameraData;
  /** One per challenge; `undefined` leaves that challenge with no settings. */
  challenges?: (GameSceneCameraData | undefined)[];
}

/** A one-stage game whose scenes carry the given camera settings. */
const gameWithCamera = ({ game, overview, stage, challenges = [undefined] }: CameraSettings = {}): GameData => ({
  title: "Camera Game",
  description: "A game for camera tests.",
  gameContainerStyle: {},
  ...(game && { modules: { camera: game } }),
  scenes: [{ purpose: "game-overview-stages", component: scroll(), camera: overview }],
  stages: [
    {
      id: "stage-1",
      scenes: [{ purpose: "shared", component: scroll(), camera: stage }],
      challengeChunking: challenges.length,
      challenges: challenges.map((camera, index) => ({
        id: `challenge-${index}`,
        solution: { answers: ["answer"] },
        scenes: [{ purpose: "challenge-in-progress", component: scroll(), camera }],
      })),
    },
  ],
});

/** Resolves camera mode on the stages overview. */
const onOverview = (settings: CameraSettings = {}) => {
  const gameData = gameWithCamera(settings);
  const state = createBlankGameState(gameData);
  return resolveCameraMode(gameData, getLayeredRenderData(state, {}, "game"));
};

/** Resolves camera mode while stage-1 and its challenges are showing. */
const inStage = (settings: CameraSettings = {}) => {
  const gameData = gameWithCamera(settings);
  const state = createBlankGameState(gameData);
  const inStageState = { ...state, current: { stageId: "stage-1", overviewScene: null } };
  const renderData: LayeredGameSceneRenderData = getLayeredRenderData(inStageState, {}, "game");
  return resolveCameraMode(gameData, renderData);
};

describe("resolveCameraMode", () => {
  it("turns camera mode on for a required camera, as for an enabled one", () => {
    expect(inStage({ game: { requirement: "required" } })).toEqual({ enabled: true, preview: true });
    expect(inStage({ stage: { requirement: "required" } })).toEqual({ enabled: true, preview: true });
  });

  it("lets a challenge's false beat the stage's required", () => {
    expect(inStage({ stage: { requirement: "required" }, challenges: [{ requirement: false }] })).toEqual({
      enabled: false,
      preview: false,
    });
  });

  it("is off, with no preview, when neither the game nor any scene sets it", () => {
    expect(onOverview()).toEqual({ enabled: false, preview: false });
  });

  it("takes the game's settings when no scene sets them", () => {
    expect(inStage({ game: { requirement: "enabled" } })).toEqual({ enabled: true, preview: true });
    expect(inStage({ game: { requirement: "enabled", preview: false } })).toEqual({ enabled: true, preview: false });
  });

  it("lets any active challenge enable camera mode, even when the stage disables it", () => {
    expect(inStage({ stage: { requirement: false }, challenges: [{ requirement: "enabled" }] })).toEqual({
      enabled: true,
      preview: true,
    });
  });

  it("lets an explicit challenge disable camera mode when no challenge enables it", () => {
    expect(inStage({ stage: { requirement: "enabled" }, challenges: [{ requirement: false }] })).toEqual({
      enabled: false,
      preview: false,
    });
  });

  it("enables camera mode when one of several active challenges enables it", () => {
    expect(
      inStage({
        stage: { requirement: false },
        challenges: [{ requirement: false }, { requirement: "enabled" }],
      }),
    ).toEqual({ enabled: true, preview: true });
  });

  it("inherits from the stage when no challenge declares camera mode", () => {
    expect(inStage({ stage: { requirement: "enabled" }, challenges: [undefined] })).toEqual({
      enabled: true,
      preview: true,
    });
  });

  it("inherits from the overview when neither challenge nor stage declares camera mode", () => {
    expect(inStage({ overview: { requirement: "enabled" } })).toEqual({ enabled: true, preview: true });
  });

  it("lets a challenge turn the preview on over a stage that turns it off", () => {
    expect(
      inStage({ game: { requirement: "enabled" }, stage: { preview: false }, challenges: [{ preview: true }] }),
    ).toEqual({
      enabled: true,
      preview: true,
    });
  });

  it("lets an explicit challenge turn the preview off over a stage that turns it on", () => {
    expect(
      inStage({ game: { requirement: "enabled" }, stage: { preview: true }, challenges: [{ preview: false }] }),
    ).toEqual({
      enabled: true,
      preview: false,
    });
  });

  it("inherits the preview from the stage when no challenge declares it", () => {
    expect(inStage({ game: { requirement: "enabled" }, stage: { preview: false } })).toEqual({
      enabled: true,
      preview: false,
    });
  });

  it("forces the preview off whenever camera mode is off", () => {
    expect(onOverview({ game: { requirement: false, preview: true }, overview: { preview: true } })).toEqual({
      enabled: false,
      preview: false,
    });
  });
});
