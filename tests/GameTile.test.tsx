import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameTile from "../src/components/landing/GameTile";
import type { GameData } from "../src/entities/data/GameData";
import type { GameSource } from "../src/entities/GameSource";
import { GameRepositoryContext } from "../src/providers/GameRepositoryContext";
import { simpleGameData } from "./data/SampleGameState";

/** Renders a tile for the game, with the given repository source. */
const renderTile = (gameData: GameData, source: GameSource, gameId = "simple-game") =>
  render(
    <MemoryRouter>
      <GameRepositoryContext.Provider value={{ source, repository: { ready: true, games: { [gameId]: gameData } } }}>
        <GameTile gameId={gameId} gameData={gameData} />
      </GameRepositoryContext.Provider>
    </MemoryRouter>,
  );

const localSource: GameSource = { type: "LocalRepository", path: "x.json" };

describe("GameTile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the game's title, id and description, and links to the game", () => {
    renderTile(simpleGameData, localSource);

    const link = screen.getByRole("link", { name: "Play Simple Game" });
    expect(link).toHaveAttribute("href", "/game/simple-game");
    expect(screen.getByRole("heading", { level: 3, name: "Simple Game" })).toBeInTheDocument();
    expect(screen.getByText("simple-game")).toBeInTheDocument();
    expect(screen.getByText("A simple game for tests.")).toBeInTheDocument();
  });

  it("shows the tile graphic resource as the background", () => {
    const game: GameData = {
      ...simpleGameData,
      resources: { poster: { type: "local", target: "games/magic-trifle/tape-still.png" } },
      tileGraphic: "poster",
    };
    renderTile(game, localSource);

    const link = screen.getByRole("link", { name: "Play Simple Game" });
    expect(link.style.backgroundImage).toContain("games/magic-trifle/tape-still.png");
  });

  it("falls back to a plain background when the graphic cannot be resolved", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const game: GameData = {
      ...simpleGameData,
      resources: { poster: { type: "relative", target: "poster.png" } },
      tileGraphic: "poster",
    };
    renderTile(game, { type: "RawRepository", repository: { games: {} } });

    expect(screen.getByRole("link", { name: "Play Simple Game" }).style.backgroundImage).toBe("");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("has no background when the game names no tile graphic", () => {
    renderTile(simpleGameData, localSource);

    expect(screen.getByRole("link", { name: "Play Simple Game" }).style.backgroundImage).toBe("");
  });
});
