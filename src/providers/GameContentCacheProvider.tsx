import { useState } from "react";
import { GameContentCacheContext, type GameContentCache } from "./GameContentCacheContext";

/** Holds the {@link GameContentCache} for everything beneath it. */
export default function ContentCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache] = useState<GameContentCache>(() => ({ templates: new Map() }));

  return <GameContentCacheContext.Provider value={cache}>{children}</GameContentCacheContext.Provider>;
}
