import { createContext } from "react";
import type { GameState } from "../entities/state/GameState";

/** The player's progress, and a way to change it. */
export interface GameStateContextType {
  /** The current progress. */
  gameState: GameState;
  /** Replaces the progress; the game re-renders from it. */
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

/** The player's progress; see `GameStateProvider`. */
export const GameStateContext = createContext<GameStateContextType>(null!);
