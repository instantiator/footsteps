import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useContext } from "react";
import { describe, expect, it } from "vitest";
import type { GameData, GameResourceDefinitions } from "../src/entities/data/GameData";
import type { GameRepository } from "../src/entities/GameRepository";
import type { GameSource } from "../src/entities/GameSource";
import { GameDataContext, GameDataLoadingContext } from "../src/providers/GameDataContext";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { getBaseURL } from "../src/util/ObjectUtils";
import { server } from "./mocks/server";

const gameWith = (resources?: GameResourceDefinitions): GameData => ({
  title: "Resource Game",
  description: "A game for tests.",
  displays: [],
  stages: [],
  gameContainerStyle: {},
  resources,
});

const rawSource = (games: GameRepository["games"]): GameSource => ({
  type: "RawRepository",
  repository: { games },
});

/** Prints the loading state, and (once ready) the game's title and resolved resources. */
const Loaded = () => {
  const { gameData, gameId, resources } = useContext(GameDataContext);
  return <output aria-label="game">{JSON.stringify({ gameId, title: gameData.title, resources })}</output>;
};

const Loading = () => <p>{`loading: ${useContext(GameDataLoadingContext).loadingState}`}</p>;

const renderProvider = (source: GameSource, id: string) =>
  render(
    <GameRepositoryProvider source={source}>
      <GameDataProvider id={id} loadingView={<Loading />}>
        <Loaded />
      </GameDataProvider>
    </GameRepositoryProvider>,
  );

const loadedGame = async () => JSON.parse((await screen.findByRole("status", { name: "game" })).textContent!);

describe("GameDataProvider", () => {
  it("waits for the repository, then provides the requested game", async () => {
    renderProvider({ type: "LocalRepository", path: "game-repository.json" }, "magic-trifle");
    expect(screen.getByText("loading: waiting-for-repository")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "game" })).toBeNull();

    const game = await loadedGame();
    expect(game.gameId).toBe("magic-trifle");
    expect(game.title).toBe("Nanny's Magic Trifle");
  });

  it("reports not-found for an id the repository does not have", () => {
    renderProvider(rawSource({ real: gameWith() }), "unknown");
    expect(screen.getByText("loading: not-found")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "game" })).toBeNull();
  });

  it.each(["constructor", "toString"])("reports not-found for the inherited key %s", (id) => {
    renderProvider(rawSource({ real: gameWith() }), id);
    expect(screen.getByText("loading: not-found")).toBeInTheDocument();
  });

  it("resolves local resources against the site, and url resources as they are", async () => {
    renderProvider(
      rawSource({
        g: gameWith({
          local: { type: "local", target: "games/magic-trifle/bells.mp3" },
          remote: { type: "url", target: "https://example.com/a/b.png" },
        }),
      }),
      "g",
    );
    const { resources } = await loadedGame();
    expect(resources).toEqual({
      local: new URL("games/magic-trifle/bells.mp3", getBaseURL()).toString(),
      remote: "https://example.com/a/b.png",
    });
  });

  it("resolves relative resources against the directory of a remote repository", async () => {
    const src = new URL("https://example.com/repos/one/repo.json");
    server.use(
      http.get(src.toString(), () =>
        HttpResponse.json({ games: { g: gameWith({ pic: { type: "relative", target: "img/pic.png" } }) } }),
      ),
    );
    renderProvider({ type: "RemoteRepository", src }, "g");
    const { resources } = await loadedGame();
    expect(resources).toEqual({ pic: "https://example.com/repos/one/img/pic.png" });
  });

  it("reports a resource-error for a relative resource in a raw repository, which has no location", () => {
    renderProvider(rawSource({ g: gameWith({ pic: { type: "relative", target: "pic.png" } }) }), "g");
    expect(screen.getByText("loading: resource-error")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "game" })).toBeNull();
  });
});
