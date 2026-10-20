import { createContext } from "react";
import type { GameState } from "../entities/state/GameState";

/** The player's progress, and a way to change it. */
export interface GameStateContextType {
  /** The current progress. */
  gameState: GameState;
  /** Sets new progress, e.g. after a correct answer. */
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

/** The player's progress, as held by `GameStateProvider`. */
export const GameStateContext = createContext<GameStateContextType>(null!);
