import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import LocalListing from "../src/components/landing/LocalListing";
import { FAILED_REPOSITORY, LOADING_REPOSITORY } from "../src/entities/GameRepository";
import { GameRepositoryContext } from "../src/providers/GameRepositoryContext";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { simpleGameData, simpleRepository } from "./data/SampleGameState";

describe("LocalListing", () => {
  it("shows a loading status while the repository loads", () => {
    render(
      <GameRepositoryContext.Provider
        value={{ source: { type: "LocalRepository", path: "x.json" }, repository: LOADING_REPOSITORY }}
      >
        <LocalListing />
      </GameRepositoryContext.Provider>,
    );
    expect(screen.getByText("Status: Loading...")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the error when the repository failed to load", () => {
    render(
      <GameRepositoryContext.Provider
        value={{
          source: { type: "LocalRepository", path: "x.json" },
          repository: { ...FAILED_REPOSITORY, error: "TypeError: failed to fetch" },
        }}
      >
        <LocalListing />
      </GameRepositoryContext.Provider>,
    );
    expect(screen.getByText("Status: TypeError: failed to fetch")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("lists each game of a ready repository as a tile linking to play it", () => {
    const otherGame = { ...simpleGameData, title: "Other Game", description: "Another game for tests." };
    render(
      <MemoryRouter>
        <GameRepositoryProvider
          source={{
            type: "RawRepository",
            repository: { games: { "simple-game": simpleGameData, "other-game": otherGame } },
          }}
        >
          <LocalListing />
        </GameRepositoryProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Status: Ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play Simple Game" })).toHaveAttribute("href", "/game/simple-game");
    expect(screen.getByRole("link", { name: "Play Other Game" })).toHaveAttribute("href", "/game/other-game");
    expect(screen.getByText("simple-game")).toBeInTheDocument();
    expect(screen.getByText("A simple game for tests.")).toBeInTheDocument();
    expect(screen.getByText("other-game")).toBeInTheDocument();
    expect(screen.getByText("Another game for tests.")).toBeInTheDocument();
  });

  it("keeps the listing free of nested lists, now that credits live under Attributions", () => {
    render(
      <MemoryRouter>
        <GameRepositoryProvider source={{ type: "RawRepository", repository: simpleRepository }}>
          <LocalListing />
        </GameRepositoryProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("list")).toBeNull();
  });
});
