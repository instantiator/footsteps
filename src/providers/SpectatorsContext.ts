import { createContext } from "react";
import type { GameSpectatorsData } from "../entities/data/scenes/GameSpectatorsData";

/** How spectators show in the scenes shown now, and what happens as they return to the floor. */
export interface ShownSpectators {
  /** How they show. */
  settings: GameSpectatorsData;
  /** Called when a spectator steps back on the floor far from where they left it. */
  onReturnElsewhere?: () => void;
}

/** The spectator settings for the camera to follow. A game provides its own. */
export const SpectatorsContext = createContext<ShownSpectators>({ settings: {} });
