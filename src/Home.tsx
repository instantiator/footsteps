import Attributions from "./components/landing/Attributions";
import Dependencies from "./components/landing/Dependencies";
import LocalListing from "./components/landing/LocalListing";
import GameRepositoryProvider from "./providers/GameRepositoryProvider";

export default function Home() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Footsteps</h1>
      <p>{import.meta.env.BASE_URL}</p>
      <h2>Local repository</h2>
      <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
        <LocalListing />
      </GameRepositoryProvider>
      <h2>Attributions</h2>
      <Attributions />
      <h2>Dependencies</h2>
      <Dependencies />
    </div>
  );
}
