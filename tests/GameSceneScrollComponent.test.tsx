import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GameSceneScrollComponent from "../src/components/core/scene/GameSceneScrollComponent";
import type { GameSceneScrollComponentData } from "../src/entities/data/scenes/GameSceneScrollComponentData";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";

const scroll: GameSceneScrollComponentData = {
  type: "scroll",
  data: {},
  contents: [
    { text: "First line\nSecond line" },
    {
      text: "Page two",
      showInput: true,
      label: "Your answer",
      media: { type: "audio", resource: "sound", audioDescription: "the bells" },
    },
  ],
};

const renderScroll = () =>
  render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <GameSceneScrollComponent contents={scroll.contents} stageId="s" challengeId="c" />
    </GameProviders>,
  );

describe("GameSceneScrollComponent", () => {
  it("shows the first page's text as one paragraph per line, with no input or audio", async () => {
    const { container } = renderScroll();
    expect((await screen.findByText("First line")).tagName).toBe("P");
    expect(screen.getByText("Second line").tagName).toBe("P");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
  });

  it("pages forwards and back through the contents", async () => {
    renderScroll();
    await screen.findByText("First line");
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Page two")).toBeInTheDocument();
    expect(screen.queryByText("First line")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(await screen.findByText("First line")).toBeInTheDocument();
  });

  it("shows the labelled input and the audio only on the pages that have them", async () => {
    const { container } = renderScroll();
    await screen.findByText("First line");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("Your answer")).toBeInTheDocument();
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("shadows the paper, under the text", async () => {
    const { container } = renderScroll();
    await screen.findByText("First line");
    const paper = container.querySelector<HTMLElement>("[style*='drop-shadow']")!;
    expect(paper.style.backgroundImage).toContain("old-paper");
    expect(paper.contains(screen.getByText("First line"))).toBe(false);
  });
});
