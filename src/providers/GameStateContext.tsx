import { createContext } from "react";
import type { GameState } from "../entities/state/GameState";

/** The player's progress, and a way to change it. */
export interface GameStateContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

/** The player's progress; see {@link GameStateProvider}. */
export const GameStateContext = createContext<GameStateContextType>(null!);
