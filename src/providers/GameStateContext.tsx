import { createContext } from "react";
import type { GameState } from "../entities/state/GameState";

export interface GameStateContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

export const GameStateContext = createContext<GameStateContextType>(null!);
