import { useParams } from "react-router-dom";
import GameJson from "../components/debug/GameJson";
import type { GameId } from "../entities/data/GameData";
import FeatureFlagsProvider from "../providers/FeatureFlagsProvider";
import { GameDataProvider } from "../providers/GameDataProvider";
import GameRepositoryProvider from "../providers/GameRepositoryProvider";
import GameStateProvider from "../providers/GameStateProvider";

export function Component() {
  const { id } = useParams();

  return (
    <>
      <FeatureFlagsProvider>
        <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
          <GameDataProvider id={id as GameId}>
            <GameStateProvider>
              <GameJson />
            </GameStateProvider>
          </GameDataProvider>
        </GameRepositoryProvider>
      </FeatureFlagsProvider>
    </>
  );
}
