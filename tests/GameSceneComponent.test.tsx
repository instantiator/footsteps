import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GameSceneComponent from "../src/components/core/scene/GameSceneComponent";
import type { GameSceneComponentData } from "../src/entities/data/scenes/GameSceneData";
import type { GameSceneRenderData } from "../src/components/core/logic/RenderDataUtils";
import { toGameSnapshot } from "../src/entities/state/GameSnapshot";
import { decorateGameState } from "../src/components/core/logic/TemplateUtils";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import { simpleGameState } from "./data/SampleGameState";
import GameProviders from "./helpers/GameProviders";

const renderScene = (
  component: GameSceneComponentData,
  layerHint: "foreground" | "background",
  resources: Record<string, string> = {},
) => {
  const scene: GameSceneRenderData = {
    purpose: "game-overview-stages",
    component,
    scope: "overview:game-overview-stages",
    run: 1,
    templateData: {
      gameState: decorateGameState(simpleGameState),
      game: toGameSnapshot("game", simpleGameState),
      componentData: {},
      data: {},
      state: {},
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
      <GameSceneComponent render={scene} layerHint={layerHint} />
    </GameProviders>,
  );
};

const templateComponent: GameSceneComponentData = {
  type: "template",
  data: {},
  backgroundTemplate: { sourceType: "embedded", content: "<p>sky</p>" },
  foregroundTemplate: { sourceType: "embedded", content: "<p>tree</p>" },
  backgroundStyle: { color: "blue" },
  foregroundStyle: { color: "green" },
  backgroundTemplateStyle: { fontFamily: "Courier" },
  foregroundTemplateStyle: { fontFamily: "Georgia" },
};

describe("GameSceneComponent", () => {
  it("renders a dialog on the game's image resource, with its pages in the foreground", async () => {
    const dialog: GameSceneComponentData = {
      type: "dialog",
      data: {},
      imageResource: "parchment",
      contents: [{ text: "A dialog page" }],
    };
    const { container, unmount } = renderScene(dialog, "background", { parchment: "https://img.example/p.png" });
    await vi.waitFor(() => expect(container.querySelector("[style*='img.example/p.png']")).not.toBeNull());
    unmount();
    renderScene(dialog, "foreground");
    expect(await screen.findByText("A dialog page")).toBeInTheDocument();
  });

  it.each([
    ["background", "sky", "blue", "Courier"],
    ["foreground", "tree", "green", "Georgia"],
  ] as const)(
    "renders the %s template with that layer's container and template styles",
    async (hint, text, colour, font) => {
      renderScene(templateComponent, hint);
      const element = await screen.findByText(text);
      expect(element.parentElement!.style.fontFamily).toBe(font);
      expect(element.parentElement!.parentElement!.style.color).toBe(colour);
    },
  );

  it("renders only the layer it is asked for", async () => {
    renderScene(templateComponent, "foreground");
    await screen.findByText("tree");
    expect(screen.queryByText("sky")).toBeNull();
  });

  it("renders a scroll scene as a scroll, with its text in the foreground", async () => {
    renderScene(
      { type: "scroll", data: {}, contents: [{ text: "Once upon a time" }, { text: "The end" }] },
      "foreground",
    );
    expect(await screen.findByText("Once upon a time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("uses a scroll's own foreground template and style when it has them", async () => {
    renderScene(
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
