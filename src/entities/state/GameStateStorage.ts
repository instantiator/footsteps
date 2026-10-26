import type { GameChallengeId } from "../data/GameChallengeData";
import type { GameId, GameData } from "../data/GameData";
import type { GameOverviewDisplayPurpose } from "../data/displays/GameDisplayData";
import type { GameStageId } from "../data/GameStageData";
import { stageCompletion } from "../../components/core/logic/GameStateUtils";
import { allDisplayScopes } from "../../components/core/logic/RenderDataUtils";
import { isDefined } from "../../util/ObjectUtils";
import { createBlankGameState, type GameState } from "./GameState";
import type { GameStageAvailabilityState, GameStageState } from "./GameStageState";

/** The version of the saved progress format; older or newer versions are ignored. */
const STORAGE_VERSION = 1;

/** Prefix for a game's saved progress key in local storage. */
const STORAGE_PREFIX = "footsteps:game-state:";

/** A game's saved progress: which challenges are solved, what the player was looking at, and display states. */
interface StoredGameProgress {
  /** The saved format's version. */
  version: number;
  /** The game this progress belongs to. */
  gameId: GameId;
  /** Solved challenge ids for each stage, in the game's authored order. */
  stages: Record<GameStageId, GameChallengeId[]>;
  /** Where the player was when the progress was saved. */
  current: {
    /** The stage being played, or null while an overview was showing. */
    stageId: GameStageId | null;
    /** The overview display that was showing, if any. */
    overviewDisplay: GameOverviewDisplayPurpose | null;
  };
  /** Each display's own state, by scope. Read as empty from progress saved before displays had state. */
  displayStates: GameState["displayStates"];
}

/** The local storage key for a game's progress. */
const storageKey = (gameId: GameId): string => `${STORAGE_PREFIX}${gameId}`;

/** Local storage, or undefined when the browser does not make it available. */
const getStorage = (): Storage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

/** Whether a parsed value is a plain object, as JSON objects should be. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a parsed value is an array of strings. */
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Whether a string names one of the overview display purposes. */
const isOverviewPurpose = (value: string): value is GameOverviewDisplayPurpose =>
  value === "game-overview-title" || value === "game-overview-stages" || value === "game-overview-complete";

/** Whether a string names an overview display the game defines. */
const isGameOverview = (value: string, gameData: GameData): value is GameOverviewDisplayPurpose =>
  isOverviewPurpose(value) && gameData.displays.some((display) => display.purpose === value);

/** Reads a saved current stage id, rejecting ids the game no longer has. */
const parseStageId = (value: unknown, gameData: GameData): GameStageId | null | undefined => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return gameData.stages.some((stage) => stage.id === value) ? value : undefined;
};

/** Reads a saved overview display purpose, rejecting purposes the game no longer has. */
const parseOverviewDisplay = (value: unknown, gameData: GameData): GameOverviewDisplayPurpose | null | undefined => {
  if (value === null) return null;
  if (typeof value !== "string" || !isGameOverview(value, gameData)) return undefined;
  return value;
};

/** Reads and validates the saved current view against the game. */
const parseCurrent = (value: unknown, gameData: GameData): StoredGameProgress["current"] | undefined => {
  if (!isRecord(value)) return undefined;

  const stageId = parseStageId(value.stageId, gameData);
  const overviewDisplay = parseOverviewDisplay(value.overviewDisplay, gameData);
  if (stageId === undefined || overviewDisplay === undefined) return undefined;
  if (stageId === null && overviewDisplay === null) return undefined;

  return { stageId, overviewDisplay };
};

/** Reads and validates the solved challenge ids for every stage. */
const parseStages = (value: unknown, gameData: GameData): Record<GameStageId, GameChallengeId[]> | undefined => {
  if (!isRecord(value) || Object.keys(value).length !== gameData.stages.length) return undefined;

  const stages: Record<GameStageId, GameChallengeId[]> = {};
  for (const stage of gameData.stages) {
    const succeeded = value[stage.id];
    if (!isStringArray(succeeded) || new Set(succeeded).size !== succeeded.length) return undefined;
    const challengeIds = new Set(stage.challenges.map((challenge) => challenge.id));
    if (!succeeded.every((challengeId) => challengeIds.has(challengeId))) return undefined;
    stages[stage.id] = [...succeeded];
  }
  return stages;
};

/** Keeps the saved display states of displays the game still has; anything malformed is dropped. */
const parseDisplayStates = (value: unknown, gameData: GameData): GameState["displayStates"] => {
  if (!isRecord(value)) return {};
  const scopes = allDisplayScopes(gameData);
  return Object.fromEntries(
    Object.entries(value).flatMap(([scope, state]) => (scopes.has(scope) && isRecord(state) ? [[scope, state]] : [])),
  );
};

/**
 * Reads and validates saved progress against the current game.
 * Returns undefined when the progress is corrupt, a different version or game, or no longer matches the game's stages.
 */
const parseProgress = (raw: string, gameId: GameId, gameData: GameData): StoredGameProgress | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || parsed.gameId !== gameId) return undefined;

  const stages = parseStages(parsed.stages, gameData);
  const current = parseCurrent(parsed.current, gameData);
  if (!isDefined(stages) || !isDefined(current)) return undefined;

  return {
    version: STORAGE_VERSION,
    gameId,
    stages,
    current,
    displayStates: parseDisplayStates(parsed.displayStates, gameData),
  };
};

/** Rebuilds the game state, deriving stage completion and availability from the saved progress. */
const stateFromProgress = (progress: StoredGameProgress, gameData: GameData): GameState => {
  const stageStates: GameStageState[] = gameData.stages.map((stage) => {
    const succeeded = new Set(progress.stages[stage.id]);
    const challengeStates = stage.challenges.map((challenge) => ({
      challenge,
      succeeded: succeeded.has(challenge.id),
    }));
    return { stage, challengeStates, completion: stageCompletion(challengeStates), availability: "locked" };
  });

  const sequential = gameData.config?.sequential ?? true;
  const firstIncomplete = stageStates.findIndex((stage) => stage.completion !== "completed");
  const unlockedThrough = sequential ? (firstIncomplete === -1 ? stageStates.length - 1 : firstIncomplete) : Infinity;
  const stages = stageStates.map((stage, index) => {
    const availability: GameStageAvailabilityState = index <= unlockedThrough ? "unlocked" : "locked";
    return { ...stage, availability };
  });

  const storedStage = isDefined(progress.current.stageId)
    ? stages.find((stage) => stage.stage.id === progress.current.stageId)
    : undefined;
  const currentStageId =
    isDefined(storedStage) && storedStage.availability === "unlocked" && storedStage.completion !== "completed"
      ? storedStage.stage.id
      : null;
  const overviewDisplay = progress.current.overviewDisplay ?? createBlankGameState(gameData).current.overviewDisplay;

  return {
    gameData,
    stages,
    current: { stageId: currentStageId, overviewDisplay },
    displayStates: progress.displayStates,
  };
};

/**
 * Saves a game's progress to local storage. Failures (for example, when storage is full or blocked)
 * are reported but do not interrupt play.
 */
export const saveGameState = (gameId: GameId, gameState: GameState): void => {
  const storage = getStorage();
  if (!isDefined(storage)) return;

  const stages: Record<GameStageId, GameChallengeId[]> = {};
  for (const stage of gameState.stages) {
    stages[stage.stage.id] = stage.challengeStates
      .filter((challenge) => challenge.succeeded)
      .map((challenge) => challenge.challenge.id);
  }

  const progress: StoredGameProgress = {
    version: STORAGE_VERSION,
    gameId,
    stages,
    current: { ...gameState.current },
    displayStates: gameState.displayStates,
  };
  try {
    storage.setItem(storageKey(gameId), JSON.stringify(progress));
  } catch (error) {
    console.warn(`Could not save progress for game "${gameId}":`, error);
  }
};

/** Loads a game's valid saved progress, or undefined when there is none or it does not match the game. */
export const loadGameState = (gameId: GameId, gameData: GameData): GameState | undefined => {
  const storage = getStorage();
  if (!isDefined(storage)) return undefined;

  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(gameId));
  } catch (error) {
    console.warn(`Could not read progress for game "${gameId}":`, error);
    return undefined;
  }
  if (raw === null) return undefined;

  const progress = parseProgress(raw, gameId, gameData);
  return isDefined(progress) ? stateFromProgress(progress, gameData) : undefined;
};

/** Removes a game's saved progress. */
export const clearGameState = (gameId: GameId): void => {
  const storage = getStorage();
  if (!isDefined(storage)) return;
  try {
    storage.removeItem(storageKey(gameId));
  } catch (error) {
    console.warn(`Could not clear progress for game "${gameId}":`, error);
  }
};
