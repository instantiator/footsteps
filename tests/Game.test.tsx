import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Game from "../src/components/core/Game";
import { SMALL_GAME_ID, smallGame, smallRepository } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";
import { stubMediaPlayback } from "./helpers/media";

beforeEach(() => {
  stubMediaPlayback();
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
});

const renderGame = () =>
  render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <Game />
    </GameProviders>,
  );

/** Opens a stage from the stages overview by clicking its link. */
const enterStage = async (n: 1 | 2) => {
  fireEvent.click(await screen.findByText(`Stage ${n}`));
  return await screen.findByText(`Question for stage-${n}`);
};

const answer = (text: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });

describe("Game", () => {
  it("shows the stages overview first, when the game has no title display", async () => {
    renderGame();
    expect(await screen.findByText("Small Game")).toBeInTheDocument();
    expect(screen.getByText("Stage 1")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("enters the stage whose link is clicked, showing its challenge", async () => {
    renderGame();
    await enterStage(1);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("Your answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close challenge" })).toBeInTheDocument();
  });

  it("does not enter a locked stage", async () => {
    renderGame();
    fireEvent.click(await screen.findByText("Stage 2"));
    expect(screen.queryByText("Question for stage-2")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps the player in the challenge, with no completion, while the answer is wrong", async () => {
    renderGame();
    await enterStage(1);
    answer("rhubarb");
    expect(screen.getByText("Question for stage-1")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it("returns to the stages overview when the right answer is typed, and unlocks the next stage", async () => {
    renderGame();
    await enterStage(1);
    answer("Custard");

    expect(screen.queryByText("Question for stage-1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close challenge" })).toBeNull();
    await enterStage(2);
  });

  it("does not re-enter a completed stage", async () => {
    renderGame();
    await enterStage(1);
    answer("custard");
    fireEvent.click(await screen.findByText("Stage 1"));
    expect(screen.queryByText("Question for stage-1")).toBeNull();
  });
});

describe("Game stylesheets", () => {
  const FONT_URL = "https://fonts.example/font.css";
  const gameLink = (href: string) => document.head.querySelector(`link[rel="stylesheet"][href="${href}"]`);

  const renderWithStylesheet = (target?: string) =>
    render(
      <GameProviders
        repository={{
          games: {
            [SMALL_GAME_ID]: {
              ...smallGame,
              resources: { ...smallGame.resources, ...(target && { "the-css": { type: "url", target } }) },
              stylesheets: target ? ["the-css"] : undefined,
            },
          },
        }}
        gameId={SMALL_GAME_ID}
      >
        <Game />
      </GameProviders>,
    );

  it("loads an https stylesheet named by the game into the document head", async () => {
    renderWithStylesheet(FONT_URL);
    await vi.waitFor(() => expect(gameLink(FONT_URL)).not.toBeNull());
  });

  it("adds no stylesheet when the game names none", async () => {
    renderWithStylesheet();
    await screen.findByText("Small Game");
    expect(gameLink(FONT_URL)).toBeNull();
  });

  it("skips, with a warning, a stylesheet that is neither https nor same-site", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderWithStylesheet("http://other.example/x.css");
    await screen.findByText("Small Game");
    expect(gameLink("http://other.example/x.css")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
