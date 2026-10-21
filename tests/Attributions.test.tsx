import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Attributions from "../src/components/landing/Attributions";
import { LOADING_REPOSITORY } from "../src/entities/GameRepository";
import { GameRepositoryContext } from "../src/providers/GameRepositoryContext";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { simpleGameData } from "./data/SampleGameState";

const withCredits = {
  ...simpleGameData,
  title: "Credited Game",
  credits: [{ text: "Linked credit", url: "https://credit.example/" }, { text: "Plain credit" }],
};

const withoutCredits = { ...simpleGameData, title: "Uncredited Game", credits: undefined };

/** Renders the attributions for a ready repository holding the given games. */
const renderWithGames = (games: Record<string, typeof simpleGameData>) =>
  render(
    <GameRepositoryProvider source={{ type: "RawRepository", repository: { games } }}>
      <Attributions />
    </GameRepositoryProvider>,
  );

describe("Attributions", () => {
  it("lists the app's own credits under a Footsteps heading, while the repository loads", () => {
    render(
      <GameRepositoryContext.Provider
        value={{ source: { type: "LocalRepository", path: "x.json" }, repository: LOADING_REPOSITORY }}
      >
        <Attributions />
      </GameRepositoryContext.Provider>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Footsteps" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shoe icons created by jessicurr11 - Flaticon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Old Large Paper PNG Clipart" })).toBeInTheDocument();
  });

  it("gives each game with credits its own heading and list", () => {
    renderWithGames({ "credited-game": withCredits, "uncredited-game": withoutCredits });

    expect(screen.getByRole("heading", { level: 3, name: "Credited Game" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Linked credit" })).toHaveAttribute("href", "https://credit.example/");
    expect(screen.getByText("Plain credit")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plain credit" })).toBeNull();
  });

  it("adds no heading for a game without credits", () => {
    renderWithGames({ "uncredited-game": withoutCredits });

    expect(screen.queryByRole("heading", { level: 3, name: "Uncredited Game" })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });
});
