import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import localRepository from "../public/game-repository.json";
import type { CameraInteraction } from "../src/components/camera/PlayerMonitor";
import Game from "../src/components/core/Game";
import type GameLayersLayout from "../src/components/core/layout/GameLayersLayout";
import type { GameData } from "../src/entities/data/GameData";
import type { GameDisplayTemplateSourceData } from "../src/entities/data/displays/GameDisplayTemplateComponentData";
import type { GameRepository } from "../src/entities/GameRepository";
import GameProviders from "./helpers/GameProviders";
import { stubMediaPlayback } from "./helpers/media";

/** The props each render gave the layout, so the test can play the camera's part. */
const { receivedLayout } = vi.hoisted(() => ({
  receivedLayout: [] as ComponentProps<typeof GameLayersLayout>[],
}));

vi.mock("../src/components/core/layout/GameLayersLayout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/components/core/layout/GameLayersLayout")>();
  const ActualLayout = actual.default;
  return {
    ...actual,
    default: (props: ComponentProps<typeof ActualLayout>) => {
      receivedLayout.push(props);
      return <ActualLayout {...props} />;
    },
  };
});

/** A template file's source, inlined, as a raw repository has no location to resolve relative files from. */
const inline = (source: GameDisplayTemplateSourceData | undefined): GameDisplayTemplateSourceData | undefined =>
  source?.sourceType === "relative"
    ? { sourceType: "embedded", content: readFileSync(`public/${source.templateSource}`, "utf8") }
    : source;

/**
 * The committed rules demo, with its templates inlined and the camera itself off: jsdom has no camera, and the
 * rules the camera can fire don't depend on it.
 */
const demo = (): GameData => {
  const game: GameData = structuredClone((localRepository as GameRepository).games["rules-demo"]);
  for (const display of [
    ...game.displays,
    ...game.stages.flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.displays)),
  ]) {
    display.camera = { enabled: false };
    if (display.component.type !== "template") continue;
    display.component.foregroundTemplate = inline(display.component.foregroundTemplate);
    display.component.backgroundTemplate = inline(display.component.backgroundTemplate);
  }
  return game;
};

/**
 * Plays the camera's part: reports the interaction to the rule that watches the element, as the layout does once
 * the player's body part is over it.
 */
const touch = (selector: string, interaction: CameraInteraction) => {
  const element = document.querySelector(selector);
  const layout = receivedLayout.at(-1)!;
  const rule = layout.cameraRules!.find((r) => element?.matches(r.selector) && r.interactions.includes(interaction));
  expect(rule, `a camera rule for ${interaction} on ${selector}`).toBeDefined();
  act(() =>
    layout.onPlayerInteraction!({ scope: rule!.scope, ruleIndex: rule!.ruleIndex, element: element!, interaction }),
  );
};

const $ = (selector: string) => document.querySelector(selector);

beforeEach(() => {
  stubMediaPlayback();
  receivedLayout.length = 0;
});

describe("rules demo, played by camera", () => {
  const start = async () => {
    render(
      <GameProviders repository={{ games: { "rules-demo": demo() } }} gameId="rules-demo">
        <Game />
      </GameProviders>,
    );
    await waitFor(() => expect($("#demo-title")).not.toBeNull());
    fireEvent.click($("#demo-title")!);
    await waitFor(() => expect($("#switch")).not.toBeNull());
  };

  it("moves the toggle at a touch of the hand", async () => {
    await start();
    expect($("#switch")).toHaveClass("position-1");
    touch("#switch", "hand");
    await waitFor(() => expect($("#switch")).toHaveClass("position-2"));
  });

  it("pops a balloon a hand touches, and scores it", async () => {
    await start();
    touch("#stage-link-balloons", "hand");
    await waitFor(() => expect($("#balloon-0")).not.toBeNull());

    touch("#balloon-0", "hand");

    await waitFor(() => expect($("#balloon-0")).toHaveClass("popping"));
    expect($("#score")).toHaveTextContent("1 / 10");
  });

  it("closes the door on lava, opens it at the start, and completes at the door's base", async () => {
    await start();
    touch("#stage-link-lava", "hand");
    await waitFor(() => expect($("#door")).not.toBeNull());

    touch("#lava-2", "foot");
    await waitFor(() => expect($("#door")).toBeNull());
    touch("#start", "foot");
    await waitFor(() => expect($("#door-base")).not.toBeNull());
    touch("#door-base", "foot");

    await waitFor(() => expect($("#stage-link-lava")).toHaveClass("completed"));
  });

  it("asks the camera not to count covered elements, as clicks don't", async () => {
    await start();
    expect(receivedLayout.at(-1)!.cameraRules!.every((rule) => !rule.includeCovered)).toBe(true);
  });
});
