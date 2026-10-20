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
