import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import GameLanding from "../src/components/landing/GameLanding";
import type { GameData } from "../src/entities/data/GameData";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { simpleGameData } from "./data/SampleGameState";

const GAME_ID = "simple-game";

/** Renders the landing page with a play route that stands in for the game. */
const renderLanding = (game: GameData = simpleGameData) =>
  render(
    <MemoryRouter initialEntries={[`/game/${GAME_ID}`]}>
      <GameRepositoryProvider source={{ type: "RawRepository", repository: { games: { [GAME_ID]: game } } }}>
        <GameDataProvider id={GAME_ID}>
          <Routes>
            <Route path="/game/:id" element={<GameLanding />} />
            <Route path="/game/:id/play" element={<p>Playing the game</p>} />
          </Routes>
        </GameDataProvider>
      </GameRepositoryProvider>
    </MemoryRouter>,
  );

describe("GameLanding", () => {
  it("shows the game's title and description", () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: "Simple Game" })).toBeInTheDocument();
    expect(screen.getByText("A simple game for tests.")).toBeInTheDocument();
  });

  it("uses the game's tile graphic as the background", () => {
    const game: GameData = {
      ...simpleGameData,
      resources: { poster: { type: "local", target: "games/magic-trifle/tape-still.png" } },
      tileGraphic: "poster",
    };
    const { container } = renderLanding(game);

    expect(container.querySelector<HTMLElement>(".game-landing")?.style.backgroundImage).toContain(
      "games/magic-trifle/tape-still.png",
    );
  });

  it("falls back to a plain background when the game names no graphic", () => {
    const { container } = renderLanding();

    expect(container.querySelector<HTMLElement>(".game-landing")?.style.backgroundImage).toBe("");
  });

  it("uses the game's font", () => {
    const game: GameData = { ...simpleGameData, gameContainerStyle: { fontFamily: '"DynaPuff", serif' } };
    const { container } = renderLanding(game);

    expect(container.querySelector<HTMLElement>(".game-landing")?.style.fontFamily).toContain("DynaPuff");
  });

  it("starts the game from the New game button", () => {
    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "New game" }));

    expect(screen.getByText("Playing the game")).toBeInTheDocument();
  });
});
