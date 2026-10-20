import { createContext } from "react";
import type { GameData, GameId } from "../entities/data/GameData";

/** Where the game data has got to: waiting for the repository, ready, no such game, or its resources failed to resolve. */
export type GameDataLoadingState = "waiting-for-repository" | "ready" | "not-found" | "resource-error";

/** How loading the requested game is going. */
export interface GameDataLoadingContextType {
  /** The current stage of loading. */
  loadingState: GameDataLoadingState;
}

/** The requested game, once loaded. */
export interface GameDataContextType {
  /** The game's authored data. */
  gameData: GameData;
  /** The game's id in the repository. */
  gameId: GameId;
  /** The game's resource URLs, resolved to absolute URLs by resource name. */
  resources: Record<string, string>;
}

/** The loading state; available whether or not the game has loaded. */
export const GameDataLoadingContext = createContext<GameDataLoadingContextType>(null!);
/** The loaded game; only available once loading has reached "ready". */
export const GameDataContext = createContext<GameDataContextType>(null!);
