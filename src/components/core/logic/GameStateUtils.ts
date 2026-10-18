import _ from "lodash";
import type { GameChallengeData, GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeAnswer, GameChallengeAnswerValidation } from "../../../entities/data/GameChallengeSolution";
import type { GameOverviewDisplayPurpose } from "../../../entities/data/displays/GameDisplayData";
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

  return isMatch ? true : [];
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
  const updatedStageState = markChallengeSucceeded(stageState, challengeId);
  const allStageChallengesComplete = updatedStageState.completion === "completed";

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

  const allStagesComplete = gameStateWithUpdatedStageStateAndUnlocks.stages.every((s) => s.completion === "completed");

  // Determine the new value for the current stage id.
  // If there's no stage overview display, automatically advance to the next stage if available.
  const newCurrentStageId = allStageChallengesComplete
    ? hasOverviewDisplay(gameState, "game-overview-stages")
      ? null // return to the stage overview if one exists
      : recommendedStageId // advance to the next stage if no overview
    : gameState.current.stageId;

  return {
    ...gameStateWithUpdatedStageStateAndUnlocks,
    current: {
      ...gameState.current,
      stageId: newCurrentStageId,
      overviewDisplay: allStagesComplete ? calcFinaleOverviewDisplay(gameState) : gameState.current.overviewDisplay,
    },
  };
}

/**
 * Marks one challenge in a stage as succeeded, and the stage as completed
 * if that was its last outstanding challenge (otherwise partial).
 */
const markChallengeSucceeded = (stageState: GameStageState, challengeId: GameChallengeId): GameStageState => {
  const challengeState = stageState.challengeStates.find((c) => c.challenge.id === challengeId);
  if (!isDefined(challengeState)) {
    throw new Error(`No challenge state found for challenge id ${challengeId} in stage id ${stageState.stage.id}`);
  }
  const challengeStates = stageState.challengeStates.map((c) =>
    c.challenge.id === challengeId ? { ...challengeState, succeeded: true } : c,
  );
  const completion: GameStageCompletionState = challengeStates.every((c) => c.succeeded) ? "completed" : "partial";
  return { ...stageState, completion, challengeStates };
};

const hasOverviewDisplay = (gameState: GameState, purpose: GameOverviewDisplayPurpose): boolean =>
  gameState.gameData.displays.some((d) => d.purpose === purpose);

/**
 * The overview to show once every stage is complete: the finale display if the game has one.
 * ponytail: the title/stages fallback looks inverted against its original comment ("fall back to
 * the title page, or the stages overview"); kept as-is in a no-behaviour-change refactor, see
 * docs/outstanding-issues.md.
 */
const calcFinaleOverviewDisplay = (gameState: GameState): GameOverviewDisplayPurpose =>
  hasOverviewDisplay(gameState, "game-overview-complete")
    ? "game-overview-complete"
    : hasOverviewDisplay(gameState, "game-overview-title")
      ? "game-overview-stages"
      : "game-overview-title";

/**
 * Identifies the id of the stage following the given stage id.
 * @param gameState current game state
 * @returns the next stage id, or undefined if there is none
 */
export const getRecommendedStageId = (gameState: GameState): GameStageId | null => {
  return gameState.stages.find((s) => s.completion !== "completed")?.stage.id ?? null;
};
