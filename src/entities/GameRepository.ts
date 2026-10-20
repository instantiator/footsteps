import type { GameData, GameId } from "./data/GameData";

/** A collection of games, keyed by id. This is the top level of a game repository JSON file. */
export interface GameRepository {
  /** Runtime-only flag, set by the provider once loading has succeeded. Not authored. */
  ready?: boolean;
  /** Runtime-only flag, set by the provider while the repository is being fetched. Not authored. */
  loading?: boolean;
  /** Runtime-only message, set by the provider if loading failed. Not authored. */
  error?: string;
  /** The games in this repository, keyed by {@link GameId}. */
  games: { [id: GameId]: GameData };
}

/** Placeholder repository shown while a repository is being fetched. */
export const LOADING_REPOSITORY: GameRepository = {
  ready: false,
  loading: true,
  games: {},
};

/** Placeholder repository used when a repository could not be loaded. */
export const FAILED_REPOSITORY: GameRepository = {
  ready: false,
  loading: false,
  games: {},
};
