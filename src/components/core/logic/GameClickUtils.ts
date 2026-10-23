import {
  DEFAULT_INTERACTIONS,
  type GameInteraction,
  type GameInteractionTarget,
  type GameOverviewDisplayPurpose,
} from "../../../entities/data/displays/GameDisplayData";
import type { GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { calcOverviewDisplay } from "./RenderDataUtils";

/** The order in which the overview displays are normally shown. */
export const GameOverviewPurposeSequence: GameOverviewDisplayPurpose[] = [
  "game-overview-title",
  "game-overview-stages",
];

/**
 * The interaction targets of the overview display the player is looking at.
 *
 * @returns element id to target, or an empty map while a stage is open
 */
export const getInteractionTargets = (state: GameState): Record<string, GameInteractionTarget> => {
  if (isDefined(state.current.stageId)) return {};
  return calcOverviewDisplay(state)?.clickIdToStageId ?? {};
};

/**
 * Works out the game state after an interaction with an element in an overview display.
 *
 * A mapped element responds only to the interactions its target accepts. An element with no
 * target only responds to a click, which moves on from the title screen.
 *
 * @returns the new state, or undefined if the interaction changes nothing
 */
export const getNewGameStateForInteraction = (
  state: GameState,
  targetId: string,
  interaction: GameInteraction,
): GameState | undefined => {
  if (isDefined(state.current.stageId)) return undefined;

  const overviewDisplay = calcOverviewDisplay(state);
  if (!isDefined(overviewDisplay)) return undefined;

  const target = overviewDisplay.clickIdToStageId?.[targetId];
  if (isDefined(target)) {
    return acceptsInteraction(target, interaction) ? enterStage(state, target.stage) : undefined;
  }

  // the title screen was clicked - any click moves to the challenges overview
  return interaction === "click" ? leaveTitleScreen(state) : undefined;
};

/** Works out the game state after a click on an overview display element; a click is one interaction among several. */
export const getNewGameStateForClick = (state: GameState, targetId: string): GameState | undefined =>
  getNewGameStateForInteraction(state, targetId, "click");

/**
 * Moves from the title screen to the stages overview, as any click (or Enter/Space) on the title does.
 * @returns the new state, or undefined if the title screen isn't showing
 */
export const leaveTitleScreen = (state: GameState): GameState | undefined => {
  if (isDefined(state.current.stageId) || calcOverviewDisplay(state)?.purpose !== "game-overview-title")
    return undefined;
  return { ...state, current: { ...state.current, overviewDisplay: "game-overview-stages" } };
};

/** Whether a target accepts the interaction; a target that names none accepts only a click. */
const acceptsInteraction = (target: GameInteractionTarget, interaction: GameInteraction): boolean =>
  (target.interactions ?? DEFAULT_INTERACTIONS).includes(interaction);

/** Enters the given stage, unless it is locked or already completed. */
const enterStage = (state: GameState, stageId: string): GameState | undefined => {
  const stageState = state.stages.find((stage) => stage.stage.id === stageId);
  if (!isDefined(stageState)) {
    throw new Error("Stage state not found for stage id: " + stageId);
  }
  if (stageState.completion === "completed" || stageState.availability === "locked") {
    return undefined;
  }
  return { ...state, current: { ...state.current, stageId } };
};
