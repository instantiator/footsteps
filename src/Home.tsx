import { Link } from "react-router";
import Attributions from "./components/landing/Attributions";
import LocalListing from "./components/landing/LocalListing";
import AppConfigProvider from "./providers/AppConfigProvider";
import useAppConfig from "./providers/AppConfigHook";
import GameRepositoryProvider from "./providers/GameRepositoryProvider";

/** Where the site is served from, for checking a deployment; shown only with `?debug=true`. */
function BasePath() {
  return useAppConfig().debug ? <p>Base path: {import.meta.env.BASE_URL}</p> : null;
}

/**
 * Landing page: the games in the local repository, links to plan the play space and to design scenes, then the
 * attributions, with a link to the dependencies and their licences.
 */
export default function Home() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Footsteps</h1>
      <AppConfigProvider>
        <BasePath />
      </AppConfigProvider>
      <h2>Local repository</h2>
      <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
        <LocalListing />
        <h2>Setup and design</h2>
        <p>
          <Link to="/setup">Plan your space</Link>: is your room big enough, and where should the camera go?
        </p>
        <p>
          <Link to="/scene-renderer">Scene designer</Link>: write a scene's HTML, and play it as you type.
        </p>
        <h2>Attributions</h2>
        <p>
          <Link to="/dependencies">Dependencies</Link>: the packages Footsteps is built with, and their licences.
        </p>
        <Attributions />
      </GameRepositoryProvider>
    </div>
  );
}
