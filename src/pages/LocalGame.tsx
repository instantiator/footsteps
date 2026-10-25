import { useParams } from "react-router";
import Game from "../components/core/Game";
import GamePermissionGuard from "../components/core/GamePermissionGuard";
import type { GameId } from "../entities/data/GameData";
import AppConfigProvider from "../providers/AppConfigProvider";
import { GameDataProvider } from "../providers/GameDataProvider";
import GameMusicProvider from "../providers/GameMusicProvider";
import GameRepositoryProvider from "../providers/GameRepositoryProvider";
import GameStateProvider from "../providers/GameStateProvider";

/** Plays the game with the id in the route, loaded from the local repository (`public/game-repository.json`). */
export default function LocalGame() {
  const { id } = useParams();

  return (
    <>
      <AppConfigProvider>
        <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
          <GameDataProvider id={id as GameId}>
            <GamePermissionGuard>
              <GameStateProvider>
                <GameMusicProvider>
                  <Game />
                </GameMusicProvider>
              </GameStateProvider>
            </GamePermissionGuard>
          </GameDataProvider>
        </GameRepositoryProvider>
      </AppConfigProvider>
    </>
  );
}
