import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import LocalListing from "../src/components/landing/LocalListing";
import { FAILED_REPOSITORY, LOADING_REPOSITORY } from "../src/entities/GameRepository";
import { GameRepositoryContext } from "../src/providers/GameRepositoryContext";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { simpleRepository } from "./data/SampleGameState";

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
    expect(screen.queryByRole("list")).toBeNull();
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
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("lists a game's credits, linked when they have a url and plain text when not", () => {
    const game = simpleRepository.games["simple-game"];
    const credits = [{ text: "Linked credit", url: "https://credit.example/" }, { text: "Plain credit" }];
    render(
      <MemoryRouter>
        <GameRepositoryProvider
          source={{ type: "RawRepository", repository: { games: { "simple-game": { ...game, credits } } } }}
        >
          <LocalListing />
        </GameRepositoryProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Linked credit" })).toHaveAttribute("href", "https://credit.example/");
    expect(screen.getByText("Plain credit")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plain credit" })).toBeNull();
  });

  it("shows no nested list for a game without credits", () => {
    render(
      <MemoryRouter>
        <GameRepositoryProvider source={{ type: "RawRepository", repository: simpleRepository }}>
          <LocalListing />
        </GameRepositoryProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("list")).toHaveLength(1);
  });

  it("lists each game of a ready repository as a link to play it", () => {
    render(
      <MemoryRouter>
        <GameRepositoryProvider source={{ type: "RawRepository", repository: simpleRepository }}>
          <LocalListing />
        </GameRepositoryProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Status: Ready")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: simpleRepository.games["simple-game"].title });
    expect(link).toHaveAttribute("href", "/game/simple-game");
    expect(screen.getAllByRole("listitem")).toHaveLength(Object.keys(simpleRepository.games).length);
  });
});
