import { useIsClient } from "@uidotdev/usehooks";
import { useEffect, useMemo, useState } from "react";
import { templateMessages } from "../components/core/logic/TemplateChecks";
import Game from "../components/core/Game";
import AppConfigProvider from "../providers/AppConfigProvider";
import { GameDataProvider } from "../providers/GameDataProvider";
import GameMusicProvider from "../providers/GameMusicProvider";
import GameRepositoryProvider from "../providers/GameRepositoryProvider";
import GameStateProvider from "../providers/GameStateProvider";
import { SCENE_RENDERER_GAME_ID, STARTER_SCENE, sceneRendererRepository } from "./SceneRendererGame";

/** How long typing must pause before the scene is rebuilt. */
const REBUILD_DELAY_MS = 400;

/**
 * A split screen for game authors: a scene's HTML on the left, with what the validator would say about it, and the
 * scene on the right, rendered in 2.5D with the mouse as feet.
 */
export default function SceneRenderer() {
  const [html, setHtml] = useState(STARTER_SCENE);
  const [rendered, setRendered] = useState(STARTER_SCENE);
  const [wrap, setWrap] = useState(false);
  // The game's hooks are client-only, and an in-memory repository is ready during prerendering
  const isClient = useIsClient();

  useEffect(() => {
    const timer = setTimeout(() => setRendered(html), REBUILD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [html]);

  const repository = useMemo(() => sceneRendererRepository(rendered), [rendered]);
  const { problems, warnings } = useMemo(() => templateMessages(rendered, true), [rendered]);

  return (
    <div style={{ display: "flex", height: "100dvh" }}>
      <div style={{ flex: "0 0 35%", display: "flex", flexDirection: "column", padding: "8px", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <label htmlFor="scene-html">Scene HTML</label>
          <label>
            <input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} /> Wrap lines
          </label>
        </div>
        <textarea
          id="scene-html"
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          spellCheck={false}
          wrap={wrap ? "soft" : "off"}
          style={{ flex: 1, fontFamily: "monospace", whiteSpace: wrap ? "pre-wrap" : "pre" }}
        />
        <ul id="scene-messages" aria-label="Validation" style={{ margin: 0, paddingLeft: "1.2em" }}>
          {problems.map((message) => (
            <li key={message} className="problem">
              Problem: {message}
            </li>
          ))}
          {warnings.map((message) => (
            <li key={message} className="warning">
              Warning: {message}
            </li>
          ))}
        </ul>
      </div>
      <div id="scene-pane" style={{ flex: 1, position: "relative" }}>
        {isClient && (
          <AppConfigProvider>
            <GameRepositoryProvider source={{ type: "RawRepository", repository }}>
              <GameDataProvider id={SCENE_RENDERER_GAME_ID}>
                {/* Keyed by the HTML, so each edit starts the scene afresh */}
                <GameStateProvider key={rendered}>
                  <GameMusicProvider>
                    <Game />
                  </GameMusicProvider>
                </GameStateProvider>
              </GameDataProvider>
            </GameRepositoryProvider>
          </AppConfigProvider>
        )}
      </div>
    </div>
  );
}
