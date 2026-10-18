import { useContext } from "react";
import { GameStateContext } from "./GameStateContext";

export function useGameState() {
  return useContext(GameStateContext);
}
