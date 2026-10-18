import { createContext } from "react";
import type { GameData, GameId } from "../entities/data/GameData";

export type GameDataLoadingState =
  | "waiting-for-repository"
  | "loading-resources"
  | "ready"
  | "not-found"
  | "resource-error";

export interface GameDataLoadingContextType {
  loadingState: GameDataLoadingState;
}

export interface GameDataContextType {
  gameData: GameData;
  gameId: GameId;
  resources: Record<string, string>;
}

export const GameDataLoadingContext = createContext<GameDataLoadingContextType>(null!);
export const GameDataContext = createContext<GameDataContextType>(null!);
