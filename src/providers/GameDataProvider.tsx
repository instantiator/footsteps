import { useContext, useMemo, type ReactNode } from "react";
import type { GameId, GameResourceDefinitions } from "../entities/data/GameData";
import type { GameSource } from "../entities/GameSource";
import { getBaseURL, isDefined, resolveRelativeURL } from "../util/ObjectUtils";
import GameContentCacheProvider from "./GameContentCacheProvider";
import {
  GameDataContext,
  GameDataLoadingContext,
  type GameDataContextType,
  type GameDataLoadingState,
} from "./GameDataContext";
import { GameRepositoryContext } from "./GameRepositoryContext";

interface GameDataProviderParams {
  /** The game to provide, picked from the repository. */
  id: GameId;
  /** Shown instead of the children until the game is ready (and when it can't be). */
  loadingView?: ReactNode;
}

/** Resolves each of a game's resource definitions to an absolute URL. */
const resolveResources = (
  definitions: GameResourceDefinitions | undefined,
  repositorySource: GameSource,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(definitions ?? {}).map(([key, def]) => {
      switch (def.type) {
        case "local":
          return [key, new URL(def.target, getBaseURL()).toString()];
        case "relative":
          return [key, resolveRelativeURL(def.target, repositorySource, "resource targets")];
        case "url":
          return [key, new URL(def.target).toString()]; // simple urls can be used directly
      }
    }),
  );

/** Provides the requested game's data, with its resources resolved, once the repository has it. */
export function GameDataProvider({ id, children, loadingView }: React.PropsWithChildren<GameDataProviderParams>) {
  const { repository, source: repositorySource } = useContext(GameRepositoryContext);
  const game = repository.ready && Object.hasOwn(repository.games, id) ? repository.games[id] : undefined;

  const { data, loadingState } = useMemo((): { data?: GameDataContextType; loadingState: GameDataLoadingState } => {
    if (!repository.ready) return { loadingState: "waiting-for-repository" };
    if (!isDefined(game)) return { loadingState: "not-found" };
    try {
      const resources = resolveResources(game.resources, repositorySource);
      return { data: { gameId: id, gameData: game, resources }, loadingState: "ready" };
    } catch (err) {
      console.error("Error loading game resources:", err);
      return { loadingState: "resource-error" };
    }
  }, [repository.ready, game, id, repositorySource]);

  const loading = useMemo(() => ({ loadingState }), [loadingState]);

  return (
    <GameDataLoadingContext.Provider value={loading}>
      {isDefined(data) ? (
        <GameDataContext.Provider value={data}>
          {/* Keyed by game, so per-game state beneath (content cache, game state) starts afresh for each game */}
          <GameContentCacheProvider key={id}>{children}</GameContentCacheProvider>
        </GameDataContext.Provider>
      ) : (
        loadingView
      )}
    </GameDataLoadingContext.Provider>
  );
}
