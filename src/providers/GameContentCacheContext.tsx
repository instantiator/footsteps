import { createContext } from "react";
import type { GameDisplayTemplateSourceData } from "../entities/data/displays/GameDisplayTemplateComponentData";

/** Content fetched during play, so it is only fetched once. */
export interface GameContentCache {
  /** Templates fetched from a URL, with their content. */
  templates: GameDisplayTemplateSourceData[];
}

/** An empty cache. */
export const BLANK_CACHE: GameContentCache = {
  templates: [],
};

/** The content cache and its setter; see `GameContentCacheProvider`. */
export const GameContentCacheContext = createContext<{
  /** What has been fetched so far. */
  cache: GameContentCache;
  /** Adds to the cache. */
  setCache: React.Dispatch<React.SetStateAction<GameContentCache>>;
}>(undefined!);
