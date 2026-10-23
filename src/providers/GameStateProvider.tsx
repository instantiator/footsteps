import { useEffect, useRef, useState, type ReactNode } from "react";
import { createBlankGameState, type GameState } from "../entities/state/GameState";
import { loadGameState, saveGameState } from "../entities/state/GameStateStorage";
import { useGameData } from "./GameDataHook";
import { GameStateContext } from "./GameStateContext";

/** Holds the player's progress, starting from saved progress when there is any, and saves each change. */
export default function GameStateProvider({ children }: { children: ReactNode }) {
  const { gameId, gameData } = useGameData();
  const [gameState, setGameState] = useState<GameState>(
    () => loadGameState(gameId, gameData) ?? createBlankGameState(gameData),
  );
  const lastSaved = useRef(gameState);

  useEffect(() => {
    if (gameState === lastSaved.current) return;
    saveGameState(gameId, gameState);
    lastSaved.current = gameState;
  }, [gameId, gameState]);

  return <GameStateContext.Provider value={{ gameState, setGameState }}>{children}</GameStateContext.Provider>;
}
