import { createContext } from "react";

/** Content fetched during play, so each URL is only fetched once. */
export interface GameContentCache {
  /** Template text by URL: fetched, or still in flight, so concurrent requests share one fetch. */
  templates: Map<string, Promise<string>>;
}

/** The content cache; see `GameContentCacheProvider`. */
export const GameContentCacheContext = createContext<GameContentCache>(undefined!);
