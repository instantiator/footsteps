import { useState, type ReactNode } from "react";
import { createBlankGameState, type GameState } from "../entities/state/GameState";
import { useGameData } from "./GameDataHook";
import { GameStateContext } from "./GameStateContext";

export default function GameStateProvider({ children }: { children: ReactNode }) {
  const { gameData } = useGameData();
  const [gameState, setGameState] = useState<GameState>(createBlankGameState(gameData));

  return <GameStateContext.Provider value={{ gameState, setGameState }}>{children}</GameStateContext.Provider>;
}
