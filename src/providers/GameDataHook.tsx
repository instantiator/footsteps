import { useContext } from "react";
import { GameDataContext, GameDataLoadingContext } from "./GameDataContext";

export function useGameLoadingData() {
  return useContext(GameDataLoadingContext);
}

export function useGameData() {
  return useContext(GameDataContext);
}
