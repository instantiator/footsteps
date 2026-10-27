import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import localRepository from "../public/game-repository.json";
import type { CameraInteraction } from "../src/components/camera/PlayerMonitor";
import Game from "../src/components/core/Game";
import type GameLayersLayout from "../src/components/core/layout/GameLayersLayout";
import type { GameData } from "../src/entities/data/GameData";
import type { GameDisplayBase, GameResetDisplay } from "../src/entities/data/displays/GameDisplayData";
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
const demo = (change: (game: GameData) => void): GameData => {
  const game: GameData = structuredClone((localRepository as GameRepository).games["rules-demo"]);
  change(game);
  const withResets = (display: GameResetDisplay | GameDisplayBase): (GameResetDisplay | GameDisplayBase)[] =>
    display.resetDisplay ? [display, ...withResets(display.resetDisplay)] : [display];
  for (const display of [
    ...game.displays,
    ...game.stages.flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.displays)),
  ].flatMap(withResets)) {
    display.camera = { enabled: false };
    if (display.component.type !== "template") continue;
    display.component.foregroundTemplate = inline(display.component.foregroundTemplate);
    display.component.backgroundTemplate = inline(display.component.backgroundTemplate);
  }
  return game;
};

/** Lets the given time pass, for the demo's countdowns and waits. */
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

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
  vi.useFakeTimers({ shouldAdvanceTime: true }); // time still passes for waitFor, and the tests can skip ahead
});
afterEach(() => vi.useRealTimers());

describe("rules demo, played by camera", () => {
  const start = async (change: (game: GameData) => void = () => {}) => {
    render(
      <GameProviders repository={{ games: { "rules-demo": demo(change) } }} gameId="rules-demo">
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
    touch("#switch", "hand-enter");
    await waitFor(() => expect($("#switch")).toHaveClass("position-2"));
  });

  /** Enters the balloons stage, and waits out its countdown. */
  const startBalloons = async () => {
    touch("#stage-link-balloons", "hand-enter");
    await waitFor(() => expect($("#countdown")).toHaveTextContent("Get ready… 3"));
    await wait(1000);
    expect($("#countdown")).toHaveTextContent("Get ready… 2");
    await wait(2000);
    await waitFor(() => expect($("#balloon-0")).not.toBeNull());
  };

  it("lights the bulb while a hand is over it", async () => {
    await start();
    touch("#bulb", "hand-enter");
    await waitFor(() => expect($("#bulb")).toHaveClass("lit"));
    touch("#bulb", "hand-exit");
    await waitFor(() => expect($("#bulb")).not.toHaveClass("lit"));
  });

  it("counts down before the balloons, then pops a balloon a hand touches, and scores it", async () => {
    await start();
    await startBalloons();

    touch("#balloon-0", "hand-enter");

    await waitFor(() => expect($("#balloon-0")).toHaveClass("popping"));
    expect($("#score")).toHaveTextContent("1 / 10");
  });

  it("completes the balloons at the target, though each pop also plays a sound", async () => {
    await start((game) => {
      game.stages.find((stage) => stage.id === "balloons")!.challenges[0].displays[0].component.data = { target: 1 };
    });
    await startBalloons();

    touch("#balloon-0", "hand-enter");

    await waitFor(() => expect($("#stage-link-balloons")).toHaveClass("completed"));
  });

  it("starts each new balloon in a different column, in the next colour", async () => {
    await start();
    await startBalloons();
    expect($("#balloon-0")).toHaveStyle({ left: "45%" });
    expect($("#balloon-0 .balloon-body")).toHaveClass("colour-0");

    touch("#balloon-0", "hand-enter");
    await waitFor(() => expect($("#balloon-0")).toHaveClass("popping"));
    // jsdom has no AnimationEvent, so React listens for the prefixed name there (browsers send animationend)
    const popEnd = Object.assign(new Event("webkitAnimationEnd", { bubbles: true }), { animationName: "pop" });
    act(() => void $("#balloon-0 .balloon-body")!.dispatchEvent(popEnd));

    await waitFor(() => expect($("#balloon-1")).toHaveStyle({ left: "47%" }));
    expect($("#balloon-1 .balloon-body")).toHaveClass("colour-1");
  });

  /** Stands on the lava's reset display's start, and waits for the floor to be revealed. */
  const returnToStart = async () => {
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Return to the start"));
    touch("#reset-start", "foot-enter");
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Get ready!"));
    await wait(3000);
    await waitFor(() => expect($("#door-base")).not.toBeNull());
  };

  it("asks for the start before the lava, sends the player back on lava, and completes at the door's base", async () => {
    await start();
    touch("#stage-link-lava", "hand-enter");
    await returnToStart();

    touch("#lava-2", "foot-enter");
    await returnToStart();
    touch("#door-base", "foot-enter");

    await waitFor(() => expect($("#stage-link-lava")).toHaveClass("completed"));
  });

  it("asks the camera not to count covered elements, as clicks don't", async () => {
    await start();
    expect(receivedLayout.at(-1)!.cameraRules!.every((rule) => !rule.includeCovered)).toBe(true);
  });
});
