import type { GameChallengeData, GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeSolution } from "../../../entities/data/GameChallengeSolution";
import type { GameStageData, GameStageId } from "../../../entities/data/GameStageData";
import type {
  GameChallengeDisplay,
  GameChallengeDisplayPurpose,
  GameDisplayBase,
  GameOverviewDisplay,
  GameStageDisplay,
  GameStageDisplayPurpose,
} from "../../../entities/data/displays/GameDisplayData";
import type { GameData, GameId } from "../../../entities/data/GameData";
import type {
  GameChallengeDisplayPurpose as ChallengePurpose,
  GameDisplayComponentData,
  GameOverviewDisplayPurpose,
} from "../../../entities/data/displays/GameDisplayData";
import type { GameChallengeState } from "../../../entities/state/GameChallengeState";
import { toGameSnapshot, type GameSnapshot } from "../../../entities/state/GameSnapshot";
import type { DisplayScope, GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { getActiveStageStateChallenges, getStageState } from "./GameStateUtils";
import { decorateGameState, type DecoratedGameState } from "./TemplateUtils";

/** Whether the game is showing its overview, or a stage (and its challenges). */
export type GameDisplayMode = "overview" | "stage";

/** Everything needed to render one display, and to respond to input on it. */
export interface GameDisplayRenderData extends GameDisplayBase {
  /** Identifies the display, and so its state. */
  scope: DisplayScope;
  /** The context for the display's template. */
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
 * Data to provide to game challenge templates.
 */
export interface GameTemplateData {
  /** The game state, with per-stage flags for templates that can't compute them. */
  gameState: DecoratedGameState;
  /** The display's own `component.data`, authored freely. */
  componentData: Record<string, unknown>;
  /** The same `component.data`, by the name rules' expressions use. */
  data: Record<string, unknown>;
  /** The display's own state. */
  state: Record<string, unknown>;
  /** A read-only view of the game's progress, as rules' expressions see it. */
  game: GameSnapshot;
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

/**
 * Identifies the combination of displays on screen. It changes when the game cuts to another
 * overview, stage or challenge display, but not when their contents update.
 */
export const getDisplayKey = ({
  overviewRenderData,
  stageRenderData,
  challengesRenderData,
}: LayeredGameDisplayRenderData): string =>
  JSON.stringify({
    overview: overviewRenderData?.purpose,
    stage: stageRenderData?.stageId,
    challenges: challengesRenderData?.map(({ stageId, challengeId, purpose }) => ({
      stageId,
      challengeId,
      purpose,
    })),
  });

/** The scope of an overview display. */
export const overviewScope = (purpose: GameOverviewDisplayPurpose): DisplayScope => `overview:${purpose}`;

/** The scope of a stage's shared display. */
export const stageScope = (stageId: GameStageId): DisplayScope => `stage:${stageId}:shared`;

/** The scope of one of a challenge's displays. */
export const challengeScope = (stageId: GameStageId, challengeId: GameChallengeId, purpose: ChallengePurpose) =>
  `challenge:${stageId}:${challengeId}:${purpose}`;

/** Every scope the game's displays have. */
export const allDisplayScopes = (gameData: GameData): Set<DisplayScope> =>
  new Set([
    ...gameData.displays.map((d) => overviewScope(d.purpose)),
    ...gameData.stages.flatMap((stage) => [
      ...(stage.displays ?? []).map(() => stageScope(stage.id)),
      ...stage.challenges.flatMap((c) => c.displays.map((d) => challengeScope(stage.id, c.id, d.purpose))),
    ]),
  ]);

/** A display's state: what it has stored, or its component's `initialState`. */
export const getDisplayState = (
  state: GameState,
  scope: DisplayScope,
  component: GameDisplayComponentData,
): Record<string, unknown> => state.displayStates[scope] ?? component.initialState ?? {};

/** A display the player can see and interact with, and what it belongs to. */
export interface ShownDisplay {
  /** Identifies the display, and so its state. */
  scope: DisplayScope;
  /** How the display renders, and its rules. */
  component: GameDisplayComponentData;
  /** The stage it belongs to; undefined for overview displays. */
  stageId?: GameStageId;
  /** The challenge it belongs to; undefined unless it is a challenge display. */
  challengeId?: GameChallengeId;
}

/**
 * The displays whose rules are live: the overview while no stage is open, otherwise the stage's shared display
 * and its active challenges' displays. (The overview still renders behind a stage, but doesn't respond.)
 */
export const getShownDisplays = (state: GameState): ShownDisplay[] => {
  if (!isDefined(state.current.stageId)) {
    const overview = calcOverviewDisplay(state);
    return isDefined(overview) ? [{ scope: overviewScope(overview.purpose), component: overview.component }] : [];
  }
  const { stageState, activeChallengeStates } = getActiveStageStateChallenges(state);
  if (!isDefined(stageState)) return [];
  const stageId = stageState.stage.id;
  const shared = calcStageDisplay(stageState.stage, "shared");
  return [
    ...(isDefined(shared) ? [{ scope: stageScope(stageId), component: shared.component, stageId }] : []),
    ...(activeChallengeStates ?? []).flatMap((challengeState) => {
      const display = calcChallengeDisplay(challengeState);
      const challengeId = challengeState.challenge.id;
      return isDefined(display)
        ? [
            {
              scope: challengeScope(stageId, challengeId, display.purpose),
              component: display.component,
              stageId,
              challengeId,
            },
          ]
        : [];
    }),
  ];
};

/** The template values every display shares, worked out once per render. */
type SharedTemplateData = Pick<GameTemplateData, "gameState" | "game" | "resources">;

/** A display's template data: the shared values, plus its own data, state and challenge. */
const templateDataFor = (
  shared: SharedTemplateData,
  state: GameState,
  { scope, component }: Pick<ShownDisplay, "scope" | "component">,
  challengeState?: GameChallengeState,
): GameTemplateData => ({
  ...shared,
  componentData: component.data,
  data: component.data,
  state: getDisplayState(state, scope, component),
  challenge: challengeState?.challenge,
  challengeState,
});

/** Gathers the render data for every layer of the current display. */
export const getLayeredRenderData = (
  state: GameState,
  resources: Record<string, string>,
  gameId: GameId,
): LayeredGameDisplayRenderData => {
  const shared = { gameState: decorateGameState(state), game: toGameSnapshot(gameId, state), resources };
  return {
    overviewRenderData: getOverviewRenderData(state, shared),
    stageRenderData: getStageDisplayRenderData(state, shared),
    challengesRenderData: getChallengesRenderData(state, shared),
  };
};

/** The overview layer: undefined if the game has no suitable overview display. */
const getOverviewRenderData = (gameState: GameState, shared: SharedTemplateData): GameDisplayRenderData | undefined => {
  const overviewDisplay = calcOverviewDisplay(gameState);
  if (!isDefined(overviewDisplay)) return undefined;
  const scope = overviewScope(overviewDisplay.purpose);
  return {
    purpose: overviewDisplay.purpose,
    component: overviewDisplay.component,
    camera: overviewDisplay.camera,
    scope,
    templateData: templateDataFor(shared, gameState, { scope, component: overviewDisplay.component }),
    stageId: undefined,
    challengeId: undefined,
    solution: undefined,
  };
};

/** The stage layer: undefined if no stage is current or it has no `shared` display. */
const getStageDisplayRenderData = (
  gameState: GameState,
  shared: SharedTemplateData,
): GameDisplayRenderData | undefined => {
  const stageState = getStageState(gameState, gameState.current.stageId!);
  if (!isDefined(stageState)) return undefined;
  const sharedStageDisplay = calcStageDisplay(stageState.stage, "shared");
  if (!isDefined(sharedStageDisplay)) return undefined;
  const scope = stageScope(stageState.stage.id);
  return {
    ...sharedStageDisplay,
    scope,
    templateData: templateDataFor(shared, gameState, { scope, component: sharedStageDisplay.component }),
    stageId: stageState.stage.id,
    challengeId: undefined,
    solution: undefined,
  };
};

/**
 * The challenge layer: one entry per active challenge, or undefined if no stage is current.
 * @throws if an active challenge has no display to show
 */
const getChallengesRenderData = (
  gameState: GameState,
  shared: SharedTemplateData,
): GameDisplayRenderData[] | undefined => {
  const { stageState, activeChallengeStates } = getActiveStageStateChallenges(gameState);
  if (!isDefined(stageState) || !isDefined(activeChallengeStates)) return undefined;
  return activeChallengeStates.map((challengeState) => {
    const challengeDisplay = calcChallengeDisplay(challengeState);
    if (!isDefined(challengeDisplay)) {
      throw new Error(`No display for challenge ${challengeState.challenge.id} in stage ${stageState.stage.id}.`);
    }
    const scope = challengeScope(stageState.stage.id, challengeState.challenge.id, challengeDisplay.purpose);
    return {
      purpose: challengeDisplay.purpose,
      component: challengeDisplay.component,
      camera: challengeDisplay.camera,
      scope,
      templateData: templateDataFor(
        shared,
        gameState,
        { scope, component: challengeDisplay.component },
        challengeState,
      ),
      stageId: stageState.stage.id,
      challengeId: challengeState.challenge.id,
      solution: challengeState.challenge.solution,
    };
  });
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

/** The order in which a challenge's displays are preferred, before and after it is solved. */
const CHALLENGE_DISPLAY_PREFERENCE: Record<"unsolved" | "solved", GameChallengeDisplayPurpose[]> = {
  unsolved: ["challenge-title", "challenge-in-progress", "challenge-completed"],
  solved: ["challenge-completed", "challenge-in-progress", "challenge-title"],
};

/**
 * Gets the challenge display for the given challenge state: the first it has of title, in-progress and
 * completed while unsolved, or of completed, in-progress and title once solved.
 * @param challengeState the state of the challenge to get the display for
 * @returns a GameChallengeDisplay if one can be determined, or undefined if not
 */
export const calcChallengeDisplay = (challengeState: GameChallengeState): GameChallengeDisplay | undefined => {
  const preference = CHALLENGE_DISPLAY_PREFERENCE[challengeState.succeeded ? "solved" : "unsolved"];
  return preference
    .map((purpose) => challengeState.challenge.displays.find((d) => d.purpose === purpose))
    .find(isDefined);
};
