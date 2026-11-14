import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameSceneDialogComponent from "../src/components/core/scene/GameSceneDialogComponent";
import type { GameSceneDialogMargins } from "../src/entities/data/scenes/GameSceneDialogComponentData";
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

const renderDialog = (props: { image?: string; margins?: GameSceneDialogMargins } = {}) =>
  render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <GameSceneDialogComponent contents={[{ text: "Hello" }]} {...props} />
    </GameProviders>,
  );

/** The box sized to the image, inside the scene-filling outer element (the size container). */
const frameOf = (container: HTMLElement) =>
  container.querySelector("[style*='container-type']")?.firstElementChild as HTMLElement;

describe("GameSceneDialogComponent", () => {
  it.each([
    ["a small image", { width: 100, height: 50 }, 2],
    ["a large image", { width: 4000, height: 5000 }, 0.8],
  ])("sizes its frame to the largest box of %s's ratio that fits, scaling up or down", async (_, size, ratio) => {
    stubImage(size);
    const { container } = renderDialog({ image: "paper.png" });
    // jsdom normalises the CSS: "2" reads back as "2 / 1", and calc(100cqh * 2) as 200cqh
    await waitFor(() => expect(frameOf(container).style.aspectRatio).toBe(`${ratio} / 1`));
    expect(frameOf(container).style.width).toBe(`min(100cqw, ${ratio * 100}cqh)`);
  });

  it("fills the scene until the image loads", async () => {
    stubImage();
    const { container } = renderDialog({ image: "paper.png" });
    await screen.findByText("Hello");
    expect(frameOf(container).style.aspectRatio).toBe("");
    expect(frameOf(container).style.height).toBe("100%");
  });

  it("draws the paper and then the text in one frame, so nothing can come between them", async () => {
    stubImage({ width: 1, height: 1 });
    const { container } = renderDialog({ image: "paper.png" });
    const text = (await screen.findByText("Hello")).closest("[id^='embedded:']")!;
    await waitFor(() => expect(container.querySelector("[style*='paper.png']")).not.toBeNull());
    const paper = container.querySelector("[style*='paper.png']")!;
    expect(paper.parentElement).toBe(frameOf(container));
    expect(text.parentElement).toBe(frameOf(container));
    expect(paper.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no image for a dialog without one", async () => {
    const { container } = renderDialog();
    await screen.findByText("Hello");
    expect(container.querySelector("[style*='background-image']")).toBeNull();
    expect(frameOf(container).style.height).toBe("100%");
  });

  it("keeps the text inside the image's margins", async () => {
    stubImage({ width: 1, height: 1 });
    renderDialog({ image: "paper.png", margins: { top: "20%", left: "10%" } });
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
