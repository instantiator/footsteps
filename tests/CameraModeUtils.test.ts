import { describe, expect, it } from "vitest";
import { resolveCameraMode } from "../src/components/core/logic/CameraModeUtils";
import { getLayeredRenderData, type LayeredGameDisplayRenderData } from "../src/components/core/logic/RenderDataUtils";
import type { GameDisplayCameraData } from "../src/entities/data/displays/GameDisplayData";
import type { GameData } from "../src/entities/data/GameData";
import type { CameraModuleData } from "../src/entities/data/GameModuleData";
import { createBlankGameState } from "../src/entities/state/GameState";
import { scroll } from "./data/GameBuilders";

/** Camera settings to give each level of a test game. */
interface CameraSettings {
  /** The game's camera module, or none. */
  game?: CameraModuleData;
  /** The overview display's settings, or none. */
  overview?: GameDisplayCameraData;
  /** The stage display's settings, or none. */
  stage?: GameDisplayCameraData;
  /** One per challenge; `undefined` leaves that challenge with no settings. */
  challenges?: (GameDisplayCameraData | undefined)[];
}

/** A one-stage game whose displays carry the given camera settings. */
const gameWithCamera = ({ game, overview, stage, challenges = [undefined] }: CameraSettings = {}): GameData => ({
  title: "Camera Game",
  description: "A game for camera tests.",
  gameContainerStyle: {},
  ...(game && { modules: { camera: game } }),
  displays: [{ purpose: "game-overview-stages", component: scroll(), camera: overview }],
  stages: [
    {
      id: "stage-1",
      displays: [{ purpose: "shared", component: scroll(), camera: stage }],
      challengeChunking: challenges.length,
      challenges: challenges.map((camera, index) => ({
        id: `challenge-${index}`,
        solution: { answers: ["answer"] },
        displays: [{ purpose: "challenge-in-progress", component: scroll(), camera }],
      })),
    },
  ],
});

/** Resolves camera mode on the stages overview. */
const onOverview = (settings: CameraSettings = {}) => {
  const gameData = gameWithCamera(settings);
  const state = createBlankGameState(gameData);
  return resolveCameraMode(gameData, getLayeredRenderData(state, {}));
};

/** Resolves camera mode while stage-1 and its challenges are showing. */
const inStage = (settings: CameraSettings = {}) => {
  const gameData = gameWithCamera(settings);
  const state = createBlankGameState(gameData);
  const inStageState = { ...state, current: { stageId: "stage-1", overviewDisplay: null } };
  const renderData: LayeredGameDisplayRenderData = getLayeredRenderData(inStageState, {});
  return resolveCameraMode(gameData, renderData);
};

describe("resolveCameraMode", () => {
  it("is off, with no preview, when neither the game nor any display sets it", () => {
    expect(onOverview()).toEqual({ enabled: false, preview: false });
  });

  it("takes the game's settings when no display sets them", () => {
    expect(inStage({ game: { enabled: true } })).toEqual({ enabled: true, preview: true });
    expect(inStage({ game: { enabled: true, preview: false } })).toEqual({ enabled: true, preview: false });
  });

  it("lets any active challenge enable camera mode, even when the stage disables it", () => {
    expect(inStage({ stage: { enabled: false }, challenges: [{ enabled: true }] })).toEqual({
      enabled: true,
      preview: true,
    });
  });

  it("lets an explicit challenge disable camera mode when no challenge enables it", () => {
    expect(inStage({ stage: { enabled: true }, challenges: [{ enabled: false }] })).toEqual({
      enabled: false,
      preview: false,
    });
  });

  it("enables camera mode when one of several active challenges enables it", () => {
    expect(
      inStage({
        stage: { enabled: false },
        challenges: [{ enabled: false }, { enabled: true }],
      }),
    ).toEqual({ enabled: true, preview: true });
  });

  it("inherits from the stage when no challenge declares camera mode", () => {
    expect(inStage({ stage: { enabled: true }, challenges: [undefined] })).toEqual({ enabled: true, preview: true });
  });

  it("inherits from the overview when neither challenge nor stage declares camera mode", () => {
    expect(inStage({ overview: { enabled: true } })).toEqual({ enabled: true, preview: true });
  });

  it("lets a challenge turn the preview on over a stage that turns it off", () => {
    expect(inStage({ game: { enabled: true }, stage: { preview: false }, challenges: [{ preview: true }] })).toEqual({
      enabled: true,
      preview: true,
    });
  });

  it("lets an explicit challenge turn the preview off over a stage that turns it on", () => {
    expect(inStage({ game: { enabled: true }, stage: { preview: true }, challenges: [{ preview: false }] })).toEqual({
      enabled: true,
      preview: false,
    });
  });

  it("inherits the preview from the stage when no challenge declares it", () => {
    expect(inStage({ game: { enabled: true }, stage: { preview: false } })).toEqual({ enabled: true, preview: false });
  });

  it("forces the preview off whenever camera mode is off", () => {
    expect(onOverview({ game: { enabled: false, preview: true }, overview: { preview: true } })).toEqual({
      enabled: false,
      preview: false,
    });
  });
});
