import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GameDisplayComponent from "../src/components/core/display/GameDisplayComponent";
import type { GameDisplayComponentData } from "../src/entities/data/displays/GameDisplayData";
import type { GameDisplayRenderData } from "../src/components/core/logic/RenderDataUtils";
import { decorateGameState } from "../src/components/core/logic/TemplateUtils";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import { simpleGameState } from "./data/SampleGameState";
import GameProviders from "./helpers/GameProviders";

const renderDisplay = (
  component: GameDisplayComponentData,
  layerHint: "foreground" | "background",
  resources: Record<string, string> = {},
) => {
  const display: GameDisplayRenderData = {
    purpose: "game-overview-stages",
    component,
    templateData: {
      gameState: decorateGameState(simpleGameState),
      componentData: {},
      resources,
      challenge: undefined,
      challengeState: undefined,
    },
    stageId: undefined,
    challengeId: undefined,
    solution: undefined,
  };
  return render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <GameDisplayComponent render={display} layerHint={layerHint} />
    </GameProviders>,
  );
};

const templateComponent: GameDisplayComponentData = {
  type: "template",
  data: {},
  backgroundTemplate: { sourceType: "embedded", content: "<p>sky</p>" },
  foregroundTemplate: { sourceType: "embedded", content: "<p>tree</p>" },
  backgroundStyle: { color: "blue" },
  foregroundStyle: { color: "green" },
  backgroundTemplateStyle: { fontFamily: "Courier" },
  foregroundTemplateStyle: { fontFamily: "Georgia" },
};

describe("GameDisplayComponent", () => {
  it("renders a dialog on the game's image resource, with its pages in the foreground", async () => {
    const dialog: GameDisplayComponentData = {
      type: "dialog",
      data: {},
      imageResource: "parchment",
      contents: [{ text: "A dialog page" }],
    };
    const { container, unmount } = renderDisplay(dialog, "background", { parchment: "https://img.example/p.png" });
    await vi.waitFor(() => expect(container.querySelector("[style*='img.example/p.png']")).not.toBeNull());
    unmount();
    renderDisplay(dialog, "foreground");
    expect(await screen.findByText("A dialog page")).toBeInTheDocument();
  });

  it.each([
    ["background", "sky", "blue", "Courier"],
    ["foreground", "tree", "green", "Georgia"],
  ] as const)(
    "renders the %s template with that layer's container and template styles",
    async (hint, text, colour, font) => {
      renderDisplay(templateComponent, hint);
      const element = await screen.findByText(text);
      expect(element.parentElement!.style.fontFamily).toBe(font);
      expect(element.parentElement!.parentElement!.style.color).toBe(colour);
    },
  );

  it("renders only the layer it is asked for", async () => {
    renderDisplay(templateComponent, "foreground");
    await screen.findByText("tree");
    expect(screen.queryByText("sky")).toBeNull();
  });

  it("renders a scroll display as a scroll, with its text in the foreground", async () => {
    renderDisplay(
      { type: "scroll", data: {}, contents: [{ text: "Once upon a time" }, { text: "The end" }] },
      "foreground",
    );
    expect(await screen.findByText("Once upon a time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("uses a scroll's own foreground template and style when it has them", async () => {
    renderDisplay(
      {
        type: "scroll",
        data: {},
        contents: [{ text: "ignored by the custom template" }],
        foregroundTemplate: { sourceType: "embedded", content: "<em>custom</em>" },
        foregroundStyle: { color: "purple" },
      },
      "foreground",
    );
    const custom = await screen.findByText("custom");
    expect(custom.parentElement!.parentElement!.style.color).toBe("purple");
    expect(screen.queryByText("ignored by the custom template")).toBeNull();
  });
});
