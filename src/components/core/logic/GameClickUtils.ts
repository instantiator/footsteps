import type { GameOverviewScenePurpose } from "../../../entities/data/scenes/GameSceneData";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { getStageState, withoutFocus } from "./GameStateUtils";
import { calcOverviewScene } from "./RenderDataUtils";

/** The order in which the overview scenes are normally shown. */
export const GameOverviewPurposeSequence: GameOverviewScenePurpose[] = ["game-overview-title", "game-overview-stages"];

/**
 * Moves from the title screen to the stages overview, as any click (or Enter/Space) on the title does.
 * @returns the new state, or undefined if the title screen isn't showing
 */
export const leaveTitleScreen = (state: GameState): GameState | undefined => {
  if (isDefined(state.current.stageId) || calcOverviewScene(state)?.purpose !== "game-overview-title") return undefined;
  return { ...state, current: { ...state.current, overviewScene: "game-overview-stages" } };
};

/**
 * Enters the given stage, unless it is locked or already completed.
 * @returns the new state, or undefined if the stage can't be entered
 * @throws if the game has no such stage
 */
export const enterStage = (state: GameState, stageId: string): GameState | undefined => {
  const stageState = state.stages.find((stage) => stage.stage.id === stageId);
  if (!isDefined(stageState)) {
    throw new Error("Stage state not found for stage id: " + stageId);
  }
  if (stageState.completion === "completed" || stageState.availability === "locked") {
    return undefined;
  }
  return withoutFocus({ ...state, current: { ...state.current, stageId } });
};

/**
 * Opens a challenge's stage showing that challenge (and its chunk) first, even if earlier ones are unsolved.
 * @returns the new state, or undefined if the stage is locked or completed, or the challenge solved
 * @throws if the game has no such stage
 */
export const goToChallenge = (state: GameState, stageId: string, challengeId: string): GameState | undefined => {
  const entered = enterStage(state, stageId);
  const challenge = getStageState(state, stageId)?.challengeStates.find((c) => c.challenge.id === challengeId);
  if (!isDefined(entered) || !isDefined(challenge) || challenge.succeeded) return undefined;
  return { ...entered, session: { ...entered.session, focusedChallenge: { stageId, challengeId } } };
};
