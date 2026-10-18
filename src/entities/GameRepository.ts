import type { GameData, GameId } from "./data/GameData";

export interface GameRepository {
  ready?: boolean;
  loading?: boolean;
  error?: string;
  games: { [id: GameId]: GameData };
}

export const LOADING_REPOSITORY: GameRepository = {
  ready: false,
  loading: true,
  games: {},
};
export const FAILED_REPOSITORY: GameRepository = {
  ready: false,
  loading: false,
  games: {},
};
