import type { GameChallengeData, GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeSolution } from "../../../entities/data/GameChallengeSolution";
import type { GameStageData, GameStageId } from "../../../entities/data/GameStageData";
import type {
  GameChallengeScene,
  GameChallengeScenePurpose,
  GameSceneBase,
  GameSceneAvatarData,
  GameSceneMode,
  GameSceneComponentData,
  GameOverviewScene,
  GameOverviewScenePurpose,
  GameStageScene,
  GameStageScenePurpose,
} from "../../../entities/data/scenes/GameSceneData";
import type { GameData, GameId } from "../../../entities/data/GameData";
import type { GameChallengeState } from "../../../entities/state/GameChallengeState";
import { toGameSnapshot, type GameSnapshot } from "../../../entities/state/GameSnapshot";
import type { SceneScope, GameState } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { avatarOver } from "./AvatarModeUtils";
import { sceneRun, getActiveStageStateChallenges, getStageState } from "./GameStateUtils";
import { decorateGameState, type DecoratedGameState } from "./TemplateUtils";

/** Whether the game is showing its overview, or a stage (and its challenges). */
export type GameRenderMode = "overview" | "stage";

/** Everything needed to render one scene, and to respond to input on it. */
export interface GameSceneRenderData extends GameSceneBase {
  /** Identifies the scene, and so its state. */
  scope: SceneScope;
  /** Which run of the scene this is; a new one rebuilds its templates. */
  run: number;
  /** The context for the scene's template. */
  templateData: GameTemplateData;
  /** The stage the scene belongs to; undefined for overview scenes. */
  stageId: GameStageId | undefined;
  /** The challenge the scene belongs to; undefined unless it is a challenge scene. */
  challengeId: GameChallengeId | undefined;
  /** The solution to check answers against; undefined unless it is a challenge scene. */
  solution: GameChallengeSolution | undefined;
}

/** The scenes to show at once, layered: the overview, the current stage's shared scene, and its active challenges. */
export interface LayeredGameSceneRenderData {
  /** Present when no stage is current. */
  overviewRenderData?: GameSceneRenderData;
  /** The current stage's `shared` scene, if it has one. */
  stageRenderData?: GameSceneRenderData;
  /** One per active challenge in the current chunk. */
  challengesRenderData?: GameSceneRenderData[];
}

/**
 * Data to provide to game challenge templates.
 */
export interface GameTemplateData {
  /** The game state, with per-stage flags for templates that can't compute them. */
  gameState: DecoratedGameState;
  /** The scene's own `component.data`, authored freely. */
  componentData: Record<string, unknown>;
  /** The same `component.data`, by the name rules' expressions use. */
  data: Record<string, unknown>;
  /** The scene's own state. */
  state: Record<string, unknown>;
  /** A read-only view of the game's progress, as rules' expressions see it. */
  game: GameSnapshot;
  /** Resolved resource URLs, by resource name. */
  resources: Record<string, string>;
  /** Only set for challenge scenes. */
  challenge: GameChallengeData | undefined;
  /** Only set for challenge scenes. */
  challengeState: GameChallengeState | undefined;
}

/** Shows the overview until a stage is entered. */
export const getRenderMode = (gameState: GameState): GameRenderMode =>
  isDefined(gameState.current.stageId) ? "stage" : "overview";

/**
 * Identifies the combination of scenes on screen. It changes when the game cuts to another
 * overview, stage or challenge scene, or a reset scene finishes, but not when their contents update.
 */
export const getSceneKey = ({
  overviewRenderData,
  stageRenderData,
  challengesRenderData,
}: LayeredGameSceneRenderData): string =>
  JSON.stringify({
    overview: overviewRenderData?.scope,
    stage: stageRenderData?.scope,
    challenges: challengesRenderData?.map(({ scope }) => scope),
  });

/** The scope of an overview scene. */
export const overviewScope = (purpose: GameOverviewScenePurpose): SceneScope => `overview:${purpose}`;

/** The scope of a stage's shared scene. */
export const stageScope = (stageId: GameStageId): SceneScope => `stage:${stageId}:shared`;

/** The scope of one of a challenge's scenes. */
export const challengeScope = (
  stageId: GameStageId,
  challengeId: GameChallengeId,
  purpose: GameChallengeScenePurpose,
) => `challenge:${stageId}:${challengeId}:${purpose}`;

/** Every scope the game's scenes have. */
export const allSceneScopes = (gameData: GameData): Set<SceneScope> =>
  new Set([
    ...gameData.scenes.map((d) => overviewScope(d.purpose)),
    ...gameData.stages.flatMap((stage) => [
      ...(stage.scenes ?? []).map(() => stageScope(stage.id)),
      ...stage.challenges.flatMap((c) => c.scenes.map((d) => challengeScope(stage.id, c.id, d.purpose))),
    ]),
  ]);

/** A scene's state: what it has stored, or its component's `initialState`. */
export const getSceneState = (
  state: GameState,
  scope: SceneScope,
  component: GameSceneComponentData,
): Record<string, unknown> => state.sceneStates[scope] ?? component.initialState ?? {};

/** The scope of a scene's reset scene. */
export const resetScope = (scope: SceneScope): SceneScope => `${scope}/reset`;

/** What shows in a scene's place: the scene itself, or one of its reset scenes. */
interface ResolvedScene {
  /** The scope of what shows. */
  scope: SceneScope;
  /** How what shows renders, and its rules. */
  component: GameSceneComponentData;
  /** Its avatar settings: a reset scene's over its parent's. */
  avatar: GameSceneAvatarData | undefined;
  /** Its layout: a reset scene's over its parent's. */
  scene: GameSceneMode | undefined;
  /** Whether what shows is a reset scene. */
  isReset: boolean;
}

/**
 * What shows in a scene's place: its deepest reset scene not yet finished since the game loaded, or the scene
 * itself once they all are. A reset scene's own reset scene shows before it.
 */
export const resolveResets = (
  state: GameState,
  scope: SceneScope,
  scene: Pick<GameSceneBase, "component" | "avatar" | "scene" | "resetScene">,
): ResolvedScene => {
  let shown: ResolvedScene = {
    scope,
    component: scene.component,
    avatar: scene.avatar,
    scene: scene.scene,
    isReset: false,
  };
  for (let reset = scene.resetScene; isDefined(reset); reset = reset.resetScene) {
    const nextScope = resetScope(shown.scope);
    if (state.session.finishedResets.includes(nextScope)) break;
    shown = {
      scope: nextScope,
      component: reset.component,
      avatar: avatarOver(shown.avatar, reset.avatar),
      scene: reset.scene ?? shown.scene,
      isReset: true,
    };
  }
  return shown;
};

/** A scene the player can see and interact with, and what it belongs to. */
export interface ShownScene {
  /** Identifies the scene, and so its state. */
  scope: SceneScope;
  /** How the scene renders, and its rules. */
  component: GameSceneComponentData;
  /** The stage it belongs to; undefined for overview scenes. */
  stageId?: GameStageId;
  /** The challenge it belongs to; undefined unless it is a challenge scene. */
  challengeId?: GameChallengeId;
  /** Whether it is a reset scene, shown in its parent's place. */
  isReset?: boolean;
}

/** A scene the game is showing, or showing a reset scene in place of: the place on screen a scene fills. */
export interface SceneSlot {
  /** The scene's own scope. */
  scope: SceneScope;
  /** The scene. */
  scene: GameSceneBase;
  /** The stage it belongs to; undefined for overview scenes. */
  stageId?: GameStageId;
  /** The challenge it belongs to; undefined unless it is a challenge scene. */
  challengeId?: GameChallengeId;
}

/**
 * The scenes the game is showing: the overview while no stage is open, otherwise the stage's shared scene and its
 * active challenges' scenes. Each may be showing a reset scene in its place.
 */
export const getSceneSlots = (state: GameState): SceneSlot[] => {
  if (!isDefined(state.current.stageId)) {
    const overview = calcOverviewScene(state);
    return isDefined(overview) ? [{ scope: overviewScope(overview.purpose), scene: overview }] : [];
  }
  const { stageState, activeChallengeStates } = getActiveStageStateChallenges(state);
  if (!isDefined(stageState)) return [];
  const stageId = stageState.stage.id;
  const shared = calcStageScene(stageState.stage, "shared");
  return [
    ...(isDefined(shared) ? [{ scope: stageScope(stageId), scene: shared, stageId }] : []),
    ...(activeChallengeStates ?? []).flatMap((challengeState) => {
      const scene = calcChallengeScene(challengeState);
      const challengeId = challengeState.challenge.id;
      if (!isDefined(scene)) return [];
      return [{ scope: challengeScope(stageId, challengeId, scene.purpose), scene, stageId, challengeId }];
    }),
  ];
};

/**
 * The scenes whose rules are live: what shows in each slot, which is a reset scene until it is finished. (The
 * overview still renders behind a stage, but doesn't respond.)
 */
export const getShownScenes = (state: GameState): ShownScene[] =>
  getSceneSlots(state).map(({ scope, scene, stageId, challengeId }) => {
    const shown = resolveResets(state, scope, scene);
    return { scope: shown.scope, component: shown.component, stageId, challengeId, isReset: shown.isReset };
  });

/** The template values every scene shares, worked out once per render. */
type SharedTemplateData = Pick<GameTemplateData, "gameState" | "game" | "resources">;

/** A scene's template data: the shared values, plus its own data, state and challenge. */
const templateDataFor = (
  shared: SharedTemplateData,
  state: GameState,
  { scope, component }: Pick<ShownScene, "scope" | "component">,
  challengeState?: GameChallengeState,
): GameTemplateData => ({
  ...shared,
  componentData: component.data,
  data: component.data,
  state: getSceneState(state, scope, component),
  challenge: challengeState?.challenge,
  challengeState,
});

/** Gathers the render data for every layer of the current scene. */
export const getLayeredRenderData = (
  state: GameState,
  resources: Record<string, string>,
  gameId: GameId,
): LayeredGameSceneRenderData => {
  const shared = { gameState: decorateGameState(state), game: toGameSnapshot(gameId, state), resources };
  return {
    overviewRenderData: getOverviewRenderData(state, shared),
    stageRenderData: getStageSceneRenderData(state, shared),
    challengesRenderData: getChallengesRenderData(state, shared),
  };
};

/** The overview layer: undefined if the game has no suitable overview scene. */
const getOverviewRenderData = (gameState: GameState, shared: SharedTemplateData): GameSceneRenderData | undefined => {
  const overviewScene = calcOverviewScene(gameState);
  if (!isDefined(overviewScene)) return undefined;
  const { scope, component, avatar, scene } = resolveResets(
    gameState,
    overviewScope(overviewScene.purpose),
    overviewScene,
  );
  return {
    purpose: overviewScene.purpose,
    component,
    avatar,
    scene,
    scope,
    run: sceneRun(gameState, scope),
    templateData: templateDataFor(shared, gameState, { scope, component }),
    stageId: undefined,
    challengeId: undefined,
    solution: undefined,
  };
};

/** The stage layer: undefined if no stage is current or it has no `shared` scene. */
const getStageSceneRenderData = (gameState: GameState, shared: SharedTemplateData): GameSceneRenderData | undefined => {
  const stageState = getStageState(gameState, gameState.current.stageId!);
  if (!isDefined(stageState)) return undefined;
  const sharedStageScene = calcStageScene(stageState.stage, "shared");
  if (!isDefined(sharedStageScene)) return undefined;
  const { scope, component, avatar, scene } = resolveResets(
    gameState,
    stageScope(stageState.stage.id),
    sharedStageScene,
  );
  return {
    ...sharedStageScene,
    component,
    avatar,
    scene,
    scope,
    run: sceneRun(gameState, scope),
    templateData: templateDataFor(shared, gameState, { scope, component }),
    stageId: stageState.stage.id,
    challengeId: undefined,
    solution: undefined,
  };
};

/**
 * The challenge layer: one entry per active challenge, or undefined if no stage is current.
 * @throws if an active challenge has no scene to show
 */
const getChallengesRenderData = (
  gameState: GameState,
  shared: SharedTemplateData,
): GameSceneRenderData[] | undefined => {
  const { stageState, activeChallengeStates } = getActiveStageStateChallenges(gameState);
  if (!isDefined(stageState) || !isDefined(activeChallengeStates)) return undefined;
  return activeChallengeStates.map((challengeState) => {
    const challengeScene = calcChallengeScene(challengeState);
    if (!isDefined(challengeScene)) {
      throw new Error(`No scene for challenge ${challengeState.challenge.id} in stage ${stageState.stage.id}.`);
    }
    const { scope, component, avatar, scene } = resolveResets(
      gameState,
      challengeScope(stageState.stage.id, challengeState.challenge.id, challengeScene.purpose),
      challengeScene,
    );
    return {
      purpose: challengeScene.purpose,
      component,
      avatar,
      scene,
      scope,
      run: sceneRun(gameState, scope),
      templateData: templateDataFor(shared, gameState, { scope, component }, challengeState),
      stageId: stageState.stage.id,
      challengeId: challengeState.challenge.id,
      solution: challengeState.challenge.solution,
    };
  });
};

/**
 * Selects the scene for the game overview: the current overview scene if one is set,
 * otherwise the title screen, falling back to the stages overview.
 */
export const calcOverviewScene = (gameState: GameState): GameOverviewScene | undefined =>
  isDefined(gameState.current.overviewScene)
    ? gameState.gameData.scenes.find((d) => d.purpose === gameState.current.overviewScene)
    : (gameState.gameData.scenes.find((d) => d.purpose === "game-overview-title") ??
      gameState.gameData.scenes.find((d) => d.purpose === "game-overview-stages"));

/**
 * Gets the stage scene for the given stage and purpose.
 * @param stage the stage to get the scene for
 * @param purpose the purpose of the scene to get
 * @returns a GameStageScene if one can be determined, or undefined if not
 */
export const calcStageScene = (stage: GameStageData, purpose: GameStageScenePurpose): GameStageScene | undefined =>
  stage.scenes?.find((d) => d.purpose === purpose);

/**
 * Gets the scenes for the given challenge states, in order (undefined where one can't be determined).
 * @param challengeStates a set of challenge states
 */
export const calcChallengeScenes = (challengeStates: GameChallengeState[]) =>
  challengeStates?.map((challengeState) => calcChallengeScene(challengeState)) ?? [];

/** The order in which a challenge's scenes are preferred, before and after it is solved. */
const CHALLENGE_SCENE_PREFERENCE: Record<"unsolved" | "solved", GameChallengeScenePurpose[]> = {
  unsolved: ["challenge-title", "challenge-in-progress", "challenge-completed"],
  solved: ["challenge-completed", "challenge-in-progress", "challenge-title"],
};

/**
 * Gets the challenge scene for the given challenge state: the first it has of title, in-progress and
 * completed while unsolved, or of completed, in-progress and title once solved.
 * @param challengeState the state of the challenge to get the scene for
 * @returns a GameChallengeScene if one can be determined, or undefined if not
 */
export const calcChallengeScene = (challengeState: GameChallengeState): GameChallengeScene | undefined => {
  const preference = CHALLENGE_SCENE_PREFERENCE[challengeState.succeeded ? "solved" : "unsolved"];
  return preference
    .map((purpose) => challengeState.challenge.scenes.find((d) => d.purpose === purpose))
    .find(isDefined);
};
