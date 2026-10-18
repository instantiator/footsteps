import { createContext } from "react";
import type { GameDisplayTemplateSourceData } from "../entities/data/displays/GameDisplayTemplateComponentData";

export interface GameContentCache {
  templates: GameDisplayTemplateSourceData[];
}

export const BLANK_CACHE: GameContentCache = {
  templates: [],
};

export const GameContentCacheContext = createContext<{
  cache: GameContentCache;
  setCache: React.Dispatch<React.SetStateAction<GameContentCache>>;
}>(undefined!);
