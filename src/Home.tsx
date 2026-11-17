import { Link } from "react-router";
import Attributions from "./components/landing/Attributions";
import Dependencies from "./components/landing/Dependencies";
import LocalListing from "./components/landing/LocalListing";
import GameRepositoryProvider from "./providers/GameRepositoryProvider";

/**
 * Landing page: a link to plan the play space, the games in the local repository, then the attributions and
 * dependency licences.
 */
export default function Home() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Footsteps</h1>
      <p>{import.meta.env.BASE_URL}</p>
      <p>
        <Link to="/setup">Plan your space</Link>: is your room big enough, and where should the camera go?
      </p>
      <h2>Local repository</h2>
      <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
        <LocalListing />
        <h2>Attributions</h2>
        <Attributions />
      </GameRepositoryProvider>
      <h2>Dependencies</h2>
      <Dependencies />
    </div>
  );
}
