import type { GameChallengeData, GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeSolution } from "../../../entities/data/GameChallengeSolution";
import type { GameStageData, GameStageId } from "../../../entities/data/GameStageData";
import type {
  GameChallengeDisplay,
  GameDisplayBase,
  GameOverviewDisplay,
  GameStageDisplay,
  GameStageDisplayPurpose,
} from "../../../entities/data/displays/GameDisplayData";
import type { GameChallengeState } from "../../../entities/state/GameChallengeState";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { getActiveStageStateChallenges, getStageState } from "./GameStateUtils";
import { decorateGameState, type DecoratedGameState } from "./TemplateUtils";

export type GameDisplayMode = "overview" | "stage";

export interface GameDisplayRenderData extends GameDisplayBase {
  templateData: GameTemplateData;
  stageId: GameStageId | undefined;
  challengeId: GameChallengeId | undefined;
  solution: GameChallengeSolution | undefined;
}

export interface LayeredGameDisplayRenderData {
  overviewRenderData?: GameDisplayRenderData;
  stageRenderData?: GameDisplayRenderData;
  challengesRenderData?: GameDisplayRenderData[];
}

/**
 * Data to provide to game challenge Mustache templates.
 */
export interface GameTemplateData {
  gameState: DecoratedGameState;
  componentData: Record<string, any>;
  resources: Record<string, string>;
  challenge: GameChallengeData | undefined;
  challengeState: GameChallengeState | undefined;
}

export const getRenderMode = (gameState: GameState): GameDisplayMode =>
  isDefined(gameState.current.stageId) ? "stage" : "overview";

export const getLayeredRenderData = (
  state: GameState,
  resources: Record<string, string>,
): LayeredGameDisplayRenderData => {
  const overviewRenderData = getOverviewRenderData(state, resources);
  const stageRenderData = getStageDisplayRenderData(state, resources);
  const challengesRenderData = getChallengesRenderData(state, resources);
  return {
    overviewRenderData,
    stageRenderData,
    challengesRenderData,
  };
};

const getOverviewRenderData = (
  gameState: GameState,
  resources: Record<string, string>,
): GameDisplayRenderData | undefined => {
  const decoratedGameState = decorateGameState(gameState);
  const overviewDisplay = calcOverviewDisplay(gameState);
  if (isDefined(overviewDisplay)) {
    const overviewTemplateData: GameTemplateData = {
      gameState: decoratedGameState,
      resources: resources,
      componentData: overviewDisplay.component.data,
      challenge: undefined,
      challengeState: undefined,
    };
    return {
      purpose: overviewDisplay.purpose,
      component: overviewDisplay.component,
      templateData: overviewTemplateData,
      stageId: undefined,
      challengeId: undefined,
      solution: undefined,
    };
  } else {
    return undefined;
  }
};

const getStageDisplayRenderData = (
  gameState: GameState,
  resources: Record<string, string>,
): GameDisplayRenderData | undefined => {
  const stageState = getStageState(gameState, gameState.current.stageId!);
  if (isDefined(stageState)) {
    const sharedStageDisplay = calcStageDisplay(stageState.stage, "shared");
    if (isDefined(sharedStageDisplay)) {
      const stageTemplateData: GameTemplateData = {
        gameState: decorateGameState(gameState),
        resources: resources,
        componentData: sharedStageDisplay.component.data,
        challenge: undefined,
        challengeState: undefined,
      };
      return {
        ...sharedStageDisplay,
        templateData: stageTemplateData,
        stageId: stageState.stage.id,
        challengeId: undefined,
        solution: undefined,
      };
    } else {
      return undefined;
    }
  }
};

const getChallengesRenderData = (
  gameState: GameState,
  resources: Record<string, string>,
): GameDisplayRenderData[] | undefined => {
  const { stageState, activeChallengeStates } = getActiveStageStateChallenges(gameState);
  if (isDefined(stageState) && isDefined(activeChallengeStates)) {
    return activeChallengeStates.map((challengeState) => {
      const challengeDisplay = calcChallengeDisplay(challengeState);
      if (isDefined(challengeDisplay)) {
        const challengeTemplateData: GameTemplateData = {
          gameState: decorateGameState(gameState),
          resources: resources,
          challenge: challengeState.challenge,
          challengeState: challengeState,
          componentData: challengeDisplay.component.data,
        };
        return {
          purpose: challengeDisplay.purpose,
          component: challengeDisplay.component,
          templateData: challengeTemplateData,
          stageId: stageState.stage.id,
          challengeId: challengeState.challenge.id,
          solution: challengeState.challenge.solution,
        };
      } else {
        throw new Error(`No display for challenge ${challengeState.challenge.id} in stage ${stageState.stage.id}.`);
      }
    });
  } else {
    return undefined;
  }
};

/**
 * Selects the appropriate display for the game overview, based on the current display type.
 */
export const calcOverviewDisplay = (gameState: GameState): GameOverviewDisplay | undefined =>
  isDefined(gameState.current.overviewDisplay)
    ? gameState.gameData.displays.find((d) => d.purpose === gameState.current.overviewDisplay)
    : (gameState.gameData.displays.find((d) => d.purpose === "game-overview-title") ??
      gameState.gameData.displays.find((d) => d.purpose === "game-overview-stages"));

/**
 * Gets the stage display for the given stage and purpose.
 * @param stage the stage to get the display for
 * @param purpose the purpose of the display to get
 * @returns a GameStageDisplay if one can be determined, or undefined if not
 */
export const calcStageDisplay = (
  stage: GameStageData,
  purpose: GameStageDisplayPurpose,
): GameStageDisplay | undefined => stage.displays?.find((d) => d.purpose === purpose);

/**
 * Gets the challenge displays for the given challenge states.
 * @param challengeStates a set of challenge states
 */
export const calcChallengeDisplays = (challengeStates: GameChallengeState[]) =>
  challengeStates?.map((challengeState) => calcChallengeDisplay(challengeState)) ?? [];

/**
 * Gets the challenge display for the given challenge state.
 * @param challengeState the state of the challenge to get the display for
 * @returns a GameChallengeDisplay if one can be determined, or undefined if not
 */
export const calcChallengeDisplay = (challengeState: GameChallengeState): GameChallengeDisplay | undefined =>
  isDefined(challengeState.displayPurpose)
    ? challengeState.challenge.displays.find((d) => d.purpose === challengeState.displayPurpose)
    : (challengeState.challenge.displays.find((d) => d.purpose === "challenge-title") ??
      challengeState.challenge.displays.find((d) => d.purpose === "challenge-in-progress") ??
      challengeState.challenge.displays.find((d) => d.purpose === "challenge-completed"));
