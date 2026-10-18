import { createContext } from "react";
import type { GameRepository } from "../entities/GameRepository";
import type { GameSource } from "../entities/GameSource";

export interface GameRepositoryContextType {
  source: GameSource;
  repository: GameRepository;
}

export const GameRepositoryContext = createContext<GameRepositoryContextType>(null!);
