import { createContext } from "react";
import type { GameRepository } from "../entities/GameRepository";
import type { GameSource } from "../entities/GameSource";

/** The repository of games, and where it came from. */
export interface GameRepositoryContextType {
  /** Where the repository is loaded from. */
  source: GameSource;
  /** Not usable until its `ready` flag is set. */
  repository: GameRepository;
}

/** The game repository; see `GameRepositoryProvider`. */
export const GameRepositoryContext = createContext<GameRepositoryContextType>(null!);
