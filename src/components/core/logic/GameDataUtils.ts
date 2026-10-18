import type { GameChallengeData, GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameData } from "../../../entities/data/GameData";
import type { GameStageId } from "../../../entities/data/GameStageData";
import type { GameChallengeState } from "../../../entities/state/GameChallengeState";
import type { GameState } from "../../../entities/state/GameState";

export function findChallenge(
  gameData: GameData,
  stageId: GameStageId,
  challengeId: GameChallengeId,
): GameChallengeData {
  const stage = gameData.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw new Error(`Stage with id ${stageId} not found.`);
  }

  const challenge = stage.challenges.find((c) => c.id === challengeId);
  if (!challenge) {
    throw new Error(`Challenge with id ${challengeId} not found in stage ${stageId}.`);
  }

  return challenge;
}

export function findChallengeState(
  gameState: GameState,
  stageId: GameStageId,
  challengeId: GameChallengeId,
): GameChallengeState {
  const stageState = gameState.stages.find((s) => s.stage.id === stageId);
  if (!stageState) {
    throw new Error(`Stage state with id ${stageId} not found.`);
  }

  const challengeState = stageState.challengeStates.find((c) => c.challenge.id === challengeId);
  if (!challengeState) {
    throw new Error(`Challenge state with id ${challengeId} not found in stage ${stageId}.`);
  }

  return challengeState;
}
