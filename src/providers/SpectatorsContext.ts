import { createContext } from "react";
import type { GameSpectatorsData } from "../entities/data/scenes/GameSceneData";

/** How spectators show in the scenes shown now, for the camera to draw them. A game provides its own. */
export const SpectatorsContext = createContext<GameSpectatorsData>({});
