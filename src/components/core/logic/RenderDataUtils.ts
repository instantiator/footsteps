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

/** Whether the game is showing its overview, or a stage (and its challenges). */
export type GameDisplayMode = "overview" | "stage";

/** Everything needed to render one display, and to respond to input on it. */
export interface GameDisplayRenderData extends GameDisplayBase {
  /** The Mustache view for the display's template. */
  templateData: GameTemplateData;
  /** The stage the display belongs to; undefined for overview displays. */
  stageId: GameStageId | undefined;
  /** The challenge the display belongs to; undefined unless it is a challenge display. */
  challengeId: GameChallengeId | undefined;
  /** The solution to check answers against; undefined unless it is a challenge display. */
  solution: GameChallengeSolution | undefined;
}

/** The displays to show at once, layered: the overview, the current stage's shared display, and its active challenges. */
export interface LayeredGameDisplayRenderData {
  /** Present when no stage is current. */
  overviewRenderData?: GameDisplayRenderData;
  /** The current stage's `shared` display, if it has one. */
  stageRenderData?: GameDisplayRenderData;
  /** One per active challenge in the current chunk. */
  challengesRenderData?: GameDisplayRenderData[];
}

/**
 * Data to provide to game challenge Mustache templates.
 */
export interface GameTemplateData {
  /** The game state, with per-stage flags for templates that can't compute them. */
  gameState: DecoratedGameState;
  /** The display's own `component.data`, authored freely. */
  componentData: Record<string, unknown>;
  /** Resolved resource URLs, by resource name. */
  resources: Record<string, string>;
  /** Only set for challenge displays. */
  challenge: GameChallengeData | undefined;
  /** Only set for challenge displays. */
  challengeState: GameChallengeState | undefined;
}

/** Shows the overview until a stage is entered. */
export const getRenderMode = (gameState: GameState): GameDisplayMode =>
  isDefined(gameState.current.stageId) ? "stage" : "overview";

/** Gathers the render data for every layer of the current display. */
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

/** The overview layer: undefined if the game has no suitable overview display. */
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

/** The stage layer: undefined if no stage is current or it has no `shared` display. */
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

/**
 * The challenge layer: one entry per active challenge, or undefined if no stage is current.
 * @throws if an active challenge has no display to show
 */
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
 * Selects the display for the game overview: the current overview display if one is set,
 * otherwise the title screen, falling back to the stages overview.
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
 * Gets the displays for the given challenge states, in order (undefined where one can't be determined).
 * @param challengeStates a set of challenge states
 */
export const calcChallengeDisplays = (challengeStates: GameChallengeState[]) =>
  challengeStates?.map((challengeState) => calcChallengeDisplay(challengeState)) ?? [];

/**
 * Gets the challenge display for the given challenge state: its set display purpose if any,
 * otherwise the first of title, in-progress and completed that it has.
 * @param challengeState the state of the challenge to get the display for
 * @returns a GameChallengeDisplay if one can be determined, or undefined if not
 */
export const calcChallengeDisplay = (challengeState: GameChallengeState): GameChallengeDisplay | undefined =>
  isDefined(challengeState.displayPurpose)
    ? challengeState.challenge.displays.find((d) => d.purpose === challengeState.displayPurpose)
    : (challengeState.challenge.displays.find((d) => d.purpose === "challenge-title") ??
      challengeState.challenge.displays.find((d) => d.purpose === "challenge-in-progress") ??
      challengeState.challenge.displays.find((d) => d.purpose === "challenge-completed"));
