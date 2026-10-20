import { useParams } from "react-router";
import GameJson from "../components/debug/GameJson";
import type { GameId } from "../entities/data/GameData";
import FeatureFlagsProvider from "../providers/FeatureFlagsProvider";
import { GameDataProvider } from "../providers/GameDataProvider";
import GameRepositoryProvider from "../providers/GameRepositoryProvider";
import GameStateProvider from "../providers/GameStateProvider";

/** Debug page: shows the data and state of the game with the id in the route, as JSON. Unlike {@link LocalGame}, it has no music provider. */
export default function LocalGameJson() {
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
