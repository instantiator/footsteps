import { useContext } from "react";
import { GameStateContext } from "./GameStateContext";

/** The player's progress, and its setter. */
export function useGameState() {
  return useContext(GameStateContext);
}
