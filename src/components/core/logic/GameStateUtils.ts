import _ from "lodash";
import type { GameChallengeData, GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeAnswer, GameChallengeAnswerValidation } from "../../../entities/data/GameChallengeSolution";
import type { GameStageId } from "../../../entities/data/GameStageData";
import type { GameChallengeState } from "../../../entities/state/GameChallengeState";
import type { GameStageCompletionState, GameStageState } from "../../../entities/state/GameStageState";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";

/**
 * Validates an answer for a given challenge
 * @param challenge the challenge (with solution) to validate against
 * @param input the submitted input
 * @returns true if the answer is correct, otherwise a GameChallengeAnswerValidation[]
 */
export function validateAnswer(
  challenge: GameChallengeData,
  input: GameChallengeAnswer,
): GameChallengeAnswerValidation[] | true {
  const solution = challenge.solution;
  let answer = input;
  let solutionAnswers = solution.answers;
  if (solution.ignoreCase ?? true) {
    answer = answer.toLowerCase();
    solutionAnswers = solutionAnswers.map((a) => a.toLowerCase());
  }
  if (solution.trimWhitespace ?? true) {
    answer = answer.trim();
    solutionAnswers = solutionAnswers.map((a) => a.trim());
  }
  if (solution.ignoreWhitespace ?? true) {
    answer = answer.replace(/\s+/g, "");
    solutionAnswers = solutionAnswers.map((a) => a.replace(/\s+/g, ""));
  }

  const isMatch = solutionAnswers.some((a) => a === answer);

  if (isMatch) {
    console.debug(`answer: "${answer}", matches.`, solutionAnswers);
    return true;
  } else {
    return [];
  }
}

/**
 * Retrieves the current stage state and its active challenges from the game state.
 * @param gameState the current game state
 * @returns the current stage state and the first chunk of challenges with any still active, or nulls if no current stage is set.
 */
export const getActiveStageStateChallenges = (
  gameState: GameState,
): { stageState: GameStageState | null; activeChallengeStates: GameChallengeState[] | null } => {
  if (!isDefined(gameState.current.stageId)) {
    return { stageState: null, activeChallengeStates: null };
  }
  const stageState = getStageState(gameState, gameState.current.stageId);
  const chunkedChallengeStates = getChunkedChallengeStates(stageState!);
  const currentChallengeStates = getCurrentChallengeStates(chunkedChallengeStates);
  return { stageState: stageState ?? null, activeChallengeStates: currentChallengeStates ?? null };
};

/**
 * Retrieves the stage state for the given stage id from the game state.
 * @param gameState the current game state
 * @param stageId the stage id to get the state for
 * @returns the GameStageState if found, otherwise undefined
 */
export const getStageState = (gameState: GameState, stageId: GameStageId): GameStageState | undefined =>
  gameState.stages.find((s) => s.stage.id === stageId);

/**
 * Chunks the challenge states for a given stage state according to its challengeChunking setting.
 * @param stageState the stage state containing challenges to chunk
 * @returns an array of arrays, each containing one or more GameChallengeStates
 */
export const getChunkedChallengeStates = (stageState: GameStageState): GameChallengeState[][] => {
  const stageData = stageState?.stage;
  const chunking = stageData?.challengeChunking ?? 1;
  return _.chunk(stageState?.challengeStates ?? [], chunking);
};

/**
 * Identifies the first chunk of challenge states that contains any still-active challenges.
 * @param chunkedChallengeStates the chunked challenge states to search through
 * @returns the first chunk containing any active challenges, or undefined if all are complete
 */
export const getCurrentChallengeStates = (
  chunkedChallengeStates: GameChallengeState[][],
): GameChallengeState[] | undefined => chunkedChallengeStates.find((chunk) => chunk.some((c) => !c.succeeded));

/**
 * Marks a challenge as complete in the game state, and advances the game.
 * @param gameState the current game state
 * @param stageId the stage id for the challenge
 * @param challengeId the challenge id to complete
 * @returns Partial<GameState> with the necessary updates to the game state
 */
export function completeChallenge(gameState: GameState, stageId: GameStageId, challengeId: GameChallengeId): GameState {
  const stageState = getStageState(gameState, stageId);
  if (!isDefined(stageState)) {
    throw new Error(`No stage state found for stage id ${stageId}`);
  }
  const challengeState = stageState.challengeStates.find((c) => c.challenge.id === challengeId);
  if (!isDefined(challengeState)) {
    throw new Error(`No challenge state found for challenge id ${challengeId} in stage id ${stageId}`);
  }

  // Mark the challenge as complete.
  const updatedChallengeState: GameChallengeState = {
    ...challengeState,
    succeeded: true,
  };

  // If not all challenges in the current stage are complete, mark the stage as partially complete.
  // If all challenges in the current stage are complete mark the stage as complete.
  const allStageChallengesComplete = stageState.challengeStates.every((c) =>
    c.challenge.id === challengeId ? true : c.succeeded,
  );
  const stageCompletion: GameStageCompletionState = allStageChallengesComplete ? "completed" : "partial";

  // Update the stage state with the updated challenge state and completion status.
  const updatedStageState: GameStageState = {
    ...stageState,
    completion: stageCompletion,
    challengeStates: stageState.challengeStates.map((c) =>
      c.challenge.id === challengeId ? updatedChallengeState : c,
    ),
  };

  const gameStateWithUpdatedStageState: GameState = {
    ...gameState,
    stages: gameState.stages.map((s) => (s.stage.id === stageId ? updatedStageState : s)),
  };

  const recommendedStageId = getRecommendedStageId(gameStateWithUpdatedStageState);

  const gameStateWithUpdatedStageStateAndUnlocks: GameState = {
    ...gameStateWithUpdatedStageState,
    stages: gameStateWithUpdatedStageState.stages.map((s) =>
      s.stage.id === recommendedStageId ? { ...s, availability: "unlocked" } : s,
    ),
  };

  // Determine if all stages are complete.
  const allStagesComplete = gameStateWithUpdatedStageStateAndUnlocks.stages.every((s) =>
    s.stage.id === stageId ? allStageChallengesComplete : s.completion === "completed",
  );

  // Check for existence of overview displays.
  const gameTitleDisplayDefined = isDefined(
    gameState.gameData.displays.find((d) => d.purpose === "game-overview-title"),
  );
  const gameStagesDisplayDefined = isDefined(
    gameState.gameData.displays.find((d) => d.purpose === "game-overview-stages"),
  );
  const gameCompletionDisplayDefined = isDefined(
    gameState.gameData.displays.find((d) => d.purpose === "game-overview-complete"),
  );

  // Determine the new value for the current stage id.
  // If there's no stage overview display, automatically advance to the next stage if available.
  const newCurrentStageId = allStageChallengesComplete
    ? gameStagesDisplayDefined
      ? null // return to the stage overview if one exists
      : recommendedStageId // advance to the next stage if no overview
    : gameState.current.stageId;

  // Determine the new overview display.
  // If all stages are complete, the game is complete - switch the overview view to a finale display.
  // If no finale display is available, fall back to the title page, or the stages overview.
  const newOverviewDisplayPurpose = allStagesComplete
    ? gameCompletionDisplayDefined
      ? "game-overview-complete"
      : gameTitleDisplayDefined
        ? "game-overview-stages"
        : "game-overview-title"
    : gameState.current.overviewDisplay;

  const newState: GameState = {
    ...gameStateWithUpdatedStageStateAndUnlocks,
    current: {
      ...gameState.current,
      stageId: newCurrentStageId,
      overviewDisplay: newOverviewDisplayPurpose,
    },
  };

  return newState;
}

/**
 * Identifies the id of the stage following the given stage id.
 * @param gameState current game state
 * @returns the next stage id, or undefined if there is none
 */
export const getRecommendedStageId = (gameState: GameState): GameStageId | null => {
  return gameState.stages.find((s) => s.completion !== "completed")?.stage.id ?? null;
};
