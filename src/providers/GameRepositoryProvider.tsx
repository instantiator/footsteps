import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { FAILED_REPOSITORY, LOADING_REPOSITORY, type GameRepository } from "../entities/GameRepository";
import type { GameSource } from "../entities/GameSource";
import { GameRepositoryContext } from "./GameRepositoryContext";

interface GameRepositoryProviderParams {
  source: GameSource;
  children: ReactNode;
}

/** Where to fetch the repository from, or undefined for a raw repository, which is already in hand. */
const repositoryURL = (source: GameSource): string | undefined => {
  switch (source.type) {
    case "RemoteRepository":
      return source.src.toString();
    case "LocalRepository":
      return `${import.meta.env.BASE_URL}${source.path}`;
    case "RawRepository":
      return undefined;
  }
};

/** Provides the game repository from the given source, fetching it if it's remote or local. */
export default function GameRepositoryProvider({ source, children }: GameRepositoryProviderParams) {
  const url = repositoryURL(source);
  // Tagged with its URL, so a response for a previous source is never shown for the current one
  const [fetched, setFetched] = useState<{ url: string; repository: GameRepository }>();

  useEffect(() => {
    if (!url) return;
    let stale = false;
    fetch(url)
      .then((response) => response.json())
      .then(
        (data) => !stale && setFetched({ url, repository: { ...data, ready: true, loading: false } as GameRepository }),
      )
      .catch((error) => {
        console.error(error);
        if (!stale) setFetched({ url, repository: { ...FAILED_REPOSITORY, error: String(error) } });
      });
    return () => {
      stale = true;
    };
  }, [url]);

  const repository = useMemo((): GameRepository => {
    if (source.type === "RawRepository") return { ...source.repository, ready: true, loading: false } as GameRepository;
    return fetched && fetched.url === url ? fetched.repository : LOADING_REPOSITORY;
  }, [source, fetched, url]);

  return <GameRepositoryContext.Provider value={{ source, repository }}>{children}</GameRepositoryContext.Provider>;
}
