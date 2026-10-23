import { useParams } from "react-router";
import GameLanding from "../components/landing/GameLanding";
import type { GameId } from "../entities/data/GameData";
import FeatureFlagsProvider from "../providers/FeatureFlagsProvider";
import { GameDataProvider } from "../providers/GameDataProvider";
import GameRepositoryProvider from "../providers/GameRepositoryProvider";

/** Shows the landing page for the game with the id in the route, loaded from the local repository. */
export default function LocalGameLanding() {
  const { id } = useParams();

  return (
    <FeatureFlagsProvider>
      <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
        <GameDataProvider id={id as GameId}>
          <GameLanding />
        </GameDataProvider>
      </GameRepositoryProvider>
    </FeatureFlagsProvider>
  );
}
