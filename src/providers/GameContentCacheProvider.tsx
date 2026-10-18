import { useState } from "react";
import { BLANK_CACHE, GameContentCacheContext, type GameContentCache } from "./GameContentCacheContext";

export default function ContentCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<GameContentCache>(BLANK_CACHE);

  return <GameContentCacheContext.Provider value={{ cache, setCache }}>{children}</GameContentCacheContext.Provider>;
}
