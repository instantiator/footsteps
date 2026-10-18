import type { GameData } from "../../src/entities/data/GameData";
import type { GameRepository } from "../../src/entities/GameRepository";
import { createBlankGameState, type GameState } from "../../src/entities/state/GameState";
import sampleRepo from "./sample-repository.json";

export const simpleRepository = sampleRepo as GameRepository;
export const simpleGameData: GameData = simpleRepository.games["simple-game"];
export const simpleGameState: GameState = createBlankGameState(simpleGameData);
