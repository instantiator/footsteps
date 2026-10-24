import type { ReactNode } from "react";
import type { AppConfig } from "../../src/config/AppConfig";
import { MemoryRouter } from "react-router";
import type { GameId } from "../../src/entities/data/GameData";
import type { GameRepository } from "../../src/entities/GameRepository";
import AppConfigProvider from "../../src/providers/AppConfigProvider";
import { GameDataProvider } from "../../src/providers/GameDataProvider";
import GameMusicProvider from "../../src/providers/GameMusicProvider";
import GameRepositoryProvider from "../../src/providers/GameRepositoryProvider";
import GameStateProvider from "../../src/providers/GameStateProvider";

/** Props for {@link GameProviders}. */
interface GameProvidersProps {
  repository: GameRepository;
  gameId: GameId;
  debug?: boolean;
  /** App config overrides, on top of `.env.test`. */
  config?: Partial<AppConfig>;
  children: ReactNode;
}

/** The real provider stack a game runs in, over an in-memory repository and a memory router. */
export default function GameProviders({ repository, gameId, debug, config, children }: GameProvidersProps) {
  return (
    <MemoryRouter>
      <AppConfigProvider {...config} debug={debug}>
        <GameRepositoryProvider source={{ type: "RawRepository", repository }}>
          <GameDataProvider id={gameId}>
            <GameStateProvider>
              <GameMusicProvider>{children}</GameMusicProvider>
            </GameStateProvider>
          </GameDataProvider>
        </GameRepositoryProvider>
      </AppConfigProvider>
    </MemoryRouter>
  );
}
