import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { applyShowResets } from "../components/core/logic/GameRuleUtils";
import { createBlankGameState, type GameState } from "../entities/state/GameState";
import { loadGameState, saveGameState } from "../entities/state/GameStateStorage";
import { useGameData } from "./GameDataHook";
import { GameStateContext } from "./GameStateContext";

/**
 * Holds the player's progress, starting from saved progress when there is any, and saves each change.
 * Every change also resets the state of displays that it shows, if they ask for that.
 */
export default function GameStateProvider({ children }: { children: ReactNode }) {
  const { gameId, gameData } = useGameData();
  const [gameState, setRawGameState] = useState<GameState>(() =>
    applyShowResets(undefined, loadGameState(gameId, gameData) ?? createBlankGameState(gameData)),
  );
  const setGameState = useCallback<Dispatch<SetStateAction<GameState>>>(
    (action) =>
      setRawGameState((previous) =>
        applyShowResets(previous, typeof action === "function" ? action(previous) : action),
      ),
    [],
  );
  const lastSaved = useRef(gameState);

  useEffect(() => {
    if (gameState === lastSaved.current) return;
    saveGameState(gameId, gameState);
    lastSaved.current = gameState;
  }, [gameId, gameState]);

  return <GameStateContext.Provider value={{ gameState, setGameState }}>{children}</GameStateContext.Provider>;
}
