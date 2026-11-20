import { Link } from "react-router";
import Attributions from "./components/landing/Attributions";
import LocalListing from "./components/landing/LocalListing";
import Tabs from "./components/landing/Tabs";
import "./components/landing/GamePanel.css";
import "./HomePage.css";
import AppConfigProvider from "./providers/AppConfigProvider";
import useAppConfig from "./providers/AppConfigHook";
import GameRepositoryProvider from "./providers/GameRepositoryProvider";

/** Where the code and its licence live. */
const REPOSITORY = "https://github.com/instantiator/footsteps";

/** Where the site is served from, for checking a deployment; shown only with `?debug=true`. */
function BasePath() {
  return useAppConfig().debug ? <> Base path: {import.meta.env.BASE_URL}</> : null;
}

/** The links for planning the play space and designing scenes. */
function SetupAndDesign() {
  return (
    <>
      <p>
        <Link to="/setup">Plan your space</Link>: is your room big enough, and where should the camera go?
      </p>
      <p>
        <Link to="/scene-renderer">Scene designer</Link>: write a scene's HTML, and play it as you type.
      </p>
    </>
  );
}

/** The dependencies' licences, then each game's credits. */
function AttributionsTab() {
  return (
    <>
      <p>
        <Link to="/dependencies">Dependencies</Link>: the packages Footsteps is built with, and their licences.
      </p>
      <Attributions />
    </>
  );
}

/**
 * The home page, sized to the window: the title, tabs for the local repository's games, setup and design, and the
 * attributions, then a footer with the licence and the source code.
 */
export default function Home() {
  return (
    <div className="home">
      <h1 className="game-panel home-title">
        <span aria-hidden="true">👣</span> Footsteps
      </h1>
      <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
        <Tabs
          className="home-tabs"
          tabs={[
            { id: "local-repository", label: "Local repository", content: <LocalListing /> },
            { id: "setup-and-design", label: "Setup and design", content: <SetupAndDesign /> },
            { id: "attributions", label: "Attributions", content: <AttributionsTab /> },
          ]}
        />
      </GameRepositoryProvider>
      <footer className="home-footer">
        Footsteps is an open source product, released under the{" "}
        <a href={`${REPOSITORY}/blob/main/LICENSE`}>MIT license</a>. Source code at:{" "}
        <a href={REPOSITORY}>instantiator/footsteps</a>.
        <AppConfigProvider>
          <BasePath />
        </AppConfigProvider>
      </footer>
    </div>
  );
}
