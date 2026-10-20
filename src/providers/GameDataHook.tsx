import { useContext } from "react";
import { GameDataContext, GameDataLoadingContext } from "./GameDataContext";

/** How loading the requested game is going. */
export function useGameLoadingData() {
  return useContext(GameDataLoadingContext);
}

/** The loaded game; only usable beneath a `GameDataProvider` that has finished loading. */
export function useGameData() {
  return useContext(GameDataContext);
}
