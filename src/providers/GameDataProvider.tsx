import { useContext, useEffect, useState, type ReactNode } from "react";
import type { GameId, GameResourceDefinitions } from "../entities/data/GameData";
import { getBaseURL, getDirectoryURL, isDefined } from "../util/ObjectUtils";
import GameContentCacheProvider from "./GameContentCacheProvider";
import {
  GameDataContext,
  GameDataLoadingContext,
  type GameDataContextType,
  type GameDataLoadingContextType,
} from "./GameDataContext";
import { GameRepositoryContext } from "./GameRepositoryContext";

interface GameDataProviderParams {
  id: GameId;
  loadingView?: ReactNode;
}

export function GameDataProvider({ id, children, loadingView }: React.PropsWithChildren<GameDataProviderParams>) {
  const { repository, source: repositorySource } = useContext(GameRepositoryContext);

  const [gameLoading, setGameLoading] = useState<GameDataLoadingContextType>({
    loadingState: "waiting-for-repository",
  });

  const [data, setData] = useState<GameDataContextType | undefined>(undefined);

  useEffect(() => {
    const loadGameResources = async (definitions: GameResourceDefinitions | undefined) => {
      const resources: Record<string, string> = {};
      if (!isDefined(definitions)) {
        return resources;
      }
      for (const [key, def] of Object.entries(definitions)) {
        switch (def.type) {
          case "local":
            resources[key] = new URL(def.target, getBaseURL()).toString();
            break;
          case "relative":
            switch (repositorySource.type) {
              case "RemoteRepository":
                resources[key] = new URL(def.target, getDirectoryURL(repositorySource.src)).toString();
                break;
              case "LocalRepository":
                resources[key] = new URL(def.target, getBaseURL()).toString();
                break;
              case "RawRepository":
                throw "Raw repository does not support relative resource targets";
            }
            break;
          case "url":
            resources[key] = new URL(def.target).toString(); // simple urls can be used directly
            break;
        }
        console.debug(`Loaded resource [${key}]: ${resources[key]}`);
      }
      return resources;
    };

    setData(undefined);
    if (repository.ready) {
      const game = repository.games[id];
      if (isDefined(game)) {
        loadGameResources(game.resources)
          .then((newResources) => {
            setData({ gameId: id, gameData: game, resources: newResources });
          })
          .catch((err: any) => {
            console.error("Error loading game resources:", err);
            setGameLoading({ loadingState: "resource-error" });
          });
      }
    }
  }, [id, repository, repositorySource]);

  useEffect(() => {
    if (!repository.ready) {
      setGameLoading({ loadingState: "waiting-for-repository" });
    }
    if (repository.ready && !isDefined(repository.games[id])) {
      setData(undefined);
      setGameLoading({ loadingState: "not-found" });
    }
    if (repository.ready && isDefined(repository.games[id]) && !isDefined(data)) {
      setGameLoading({ loadingState: "loading-resources" });
    }
    if (repository.ready && isDefined(repository.games[id]) && isDefined(data)) {
      setGameLoading({ loadingState: "ready" });
    }
  }, [repository, id, data]);

  useEffect(() => {
    console.debug(`Game loading state: ${gameLoading.loadingState}`);
  }, [gameLoading.loadingState]);

  return (
    <>
      <GameDataLoadingContext.Provider value={gameLoading}>
        {!isDefined(data) && <>{loadingView}</>}
        {isDefined(data) && (
          <>
            <GameDataContext.Provider value={data}>
              <GameContentCacheProvider>{children}</GameContentCacheProvider>
            </GameDataContext.Provider>
          </>
        )}
      </GameDataLoadingContext.Provider>
    </>
  );
}
