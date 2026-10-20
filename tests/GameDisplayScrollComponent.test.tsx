import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GameDisplayScrollComponent from "../src/components/core/display/GameDisplayScrollComponent";
import type { GameDisplayScrollComponentData } from "../src/entities/data/displays/GameDisplayScrollComponentData";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";

const scroll: GameDisplayScrollComponentData = {
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

const renderScroll = (layerHint: "foreground" | "background" = "foreground") =>
  render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <GameDisplayScrollComponent contents={scroll.contents} layerHint={layerHint} stageId="s" challengeId="c" />
    </GameProviders>,
  );

describe("GameDisplayScrollComponent", () => {
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

  it("draws the controls and text only in the foreground, leaving the paper to the background", async () => {
    const { container } = renderScroll("background");
    await waitFor(() => expect(container.querySelector("[id^='embedded:']")).not.toBeNull());
    expect(screen.queryByText("First line")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(container.querySelector("p")).toBeNull();
  });
});
