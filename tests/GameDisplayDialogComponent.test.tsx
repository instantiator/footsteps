import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameDisplayDialogComponent from "../src/components/core/display/GameDisplayDialogComponent";
import type { GameDisplayDialogMargins } from "../src/entities/data/displays/GameDisplayDialogComponentData";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";

/** Stands in for the browser's Image, which jsdom never loads: "loads" with the given size, or never. */
const stubImage = (size?: { width: number; height: number }) =>
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = size?.width ?? 0;
      naturalHeight = size?.height ?? 0;
      onload: (() => void) | null = null;
      set src(_url: string) {
        if (size) setTimeout(() => this.onload?.());
      }
    },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderDialog = (
  layerHint: "foreground" | "background",
  props: { image?: string; margins?: GameDisplayDialogMargins } = {},
) =>
  render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <GameDisplayDialogComponent contents={[{ text: "Hello" }]} layerHint={layerHint} {...props} />
    </GameProviders>,
  );

/** The box sized to the image, inside the display-filling outer element (the size container). */
const frameOf = (container: HTMLElement) =>
  container.querySelector("[style*='container-type']")?.firstElementChild as HTMLElement;

describe("GameDisplayDialogComponent", () => {
  it.each([
    ["a small image", { width: 100, height: 50 }, 2],
    ["a large image", { width: 4000, height: 5000 }, 0.8],
  ])("sizes its frame to the largest box of %s's ratio that fits, scaling up or down", async (_, size, ratio) => {
    stubImage(size);
    const { container } = renderDialog("foreground", { image: "paper.png" });
    // jsdom normalises the CSS: "2" reads back as "2 / 1", and calc(100cqh * 2) as 200cqh
    await waitFor(() => expect(frameOf(container).style.aspectRatio).toBe(`${ratio} / 1`));
    expect(frameOf(container).style.width).toBe(`min(100cqw, ${ratio * 100}cqh)`);
  });

  it("fills the display until the image loads", async () => {
    stubImage();
    const { container } = renderDialog("foreground", { image: "paper.png" });
    await screen.findByText("Hello");
    expect(frameOf(container).style.aspectRatio).toBe("");
    expect(frameOf(container).style.height).toBe("100%");
  });

  it("draws the image in the background, and nothing behind a dialog without one", async () => {
    stubImage({ width: 1, height: 1 });
    const withImage = renderDialog("background", { image: "paper.png" });
    await waitFor(() => expect(withImage.container.querySelector("[style*='paper.png']")).not.toBeNull());
    withImage.unmount();

    const { container } = renderDialog("background");
    await waitFor(() => expect(container.querySelector("[id^='embedded:']")).not.toBeNull());
    expect(container.querySelector("[style*='background-image']")).toBeNull();
    expect(frameOf(container).style.height).toBe("100%");
  });

  it("keeps the text inside the image's margins", async () => {
    stubImage({ width: 1, height: 1 });
    renderDialog("foreground", { image: "paper.png", margins: { top: "20%", left: "10%" } });
    const column = (await screen.findByText("Hello")).closest("[id^='embedded:']") as HTMLElement;
    expect(column.style.position).toBe("absolute");
    expect([column.style.top, column.style.right, column.style.bottom, column.style.left]).toEqual([
      "20%",
      "0px",
      "0px",
      "10%",
    ]);
  });
});
