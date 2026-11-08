import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import localRepository from "../public/game-repository.json";
import type { CameraInteraction } from "../src/components/camera/PlayerMonitor";
import Game from "../src/components/core/Game";
import type GameLayersLayout from "../src/components/core/layout/GameLayersLayout";
import type { GameData } from "../src/entities/data/GameData";
import type { GameSceneBase, GameResetScene } from "../src/entities/data/scenes/GameSceneData";
import type { GameSceneTemplateSourceData } from "../src/entities/data/scenes/GameSceneTemplateComponentData";
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
const inline = (source: GameSceneTemplateSourceData | undefined): GameSceneTemplateSourceData | undefined =>
  source?.sourceType === "relative"
    ? { sourceType: "embedded", content: readFileSync(`public/${source.templateSource}`, "utf8") }
    : source;

/**
 * The committed rules demo, with its templates inlined and the camera itself off (mouse-feet stays): jsdom has no
 * camera, and the rules the camera can fire don't depend on it.
 */
const demo = (change: (game: GameData) => void): GameData => {
  const game: GameData = structuredClone((localRepository as GameRepository).games["rules-demo"]);
  change(game);
  const withResets = (scene: GameResetScene | GameSceneBase): (GameResetScene | GameSceneBase)[] =>
    scene.resetScene ? [scene, ...withResets(scene.resetScene)] : [scene];
  for (const scene of [
    ...game.scenes,
    // The effects stage acts on players, so it can't load without the camera
    ...game.stages
      .filter((stage) => stage.id !== "effects")
      .flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.scenes)),
  ].flatMap(withResets)) {
    if (scene.avatar?.mode !== "mouse-feet") scene.avatar = { mode: "mouse" };
    if (scene.component.type !== "template") continue;
    scene.component.foregroundTemplate = inline(scene.component.foregroundTemplate);
    scene.component.backgroundTemplate = inline(scene.component.backgroundTemplate);
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
  const rule = layout.cameraRules!.find(
    (r) => element?.matches(r.selector ?? "") && r.interactions.includes(interaction),
  );
  expect(rule, `a camera rule for ${interaction} on ${selector}`).toBeDefined();
  act(() =>
    layout.onPlayerInteraction!({
      scope: rule!.scope,
      ruleIndex: rule!.ruleIndex,
      element: element!,
      interaction,
      player: 0,
    }),
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
      game.stages.find((stage) => stage.id === "balloons")!.challenges[0].scenes[0].component.data = { target: 1 };
    });
    await startBalloons();

    touch("#balloon-0", "hand-enter");

    await waitFor(() => expect($("#stage-link-balloons")).toHaveClass("completed"));
  });

  it("starts each new balloon in a different column, in the next colour", async () => {
    await start();
    await startBalloons();
    expect($("#balloon-0")).toHaveStyle({ left: "45cqw" });
    expect($("#balloon-0 .balloon-body")).toHaveAttribute("data-colour", "0");

    touch("#balloon-0", "hand-enter");
    await waitFor(() => expect($("#balloon-0")).toHaveClass("popping"));
    // jsdom has no AnimationEvent, so React listens for the prefixed name there (browsers send animationend)
    const popEnd = Object.assign(new Event("webkitAnimationEnd", { bubbles: true }), { animationName: "pop" });
    act(() => void $("#balloon-0 .balloon-body")!.dispatchEvent(popEnd));

    await waitFor(() => expect($("#balloon-1")).toHaveStyle({ left: "47cqw" }));
    expect($("#balloon-1 .balloon-body")).toHaveAttribute("data-colour", "1");
  });

  /** Stands on the lava's reset scene's start, and waits for the floor to be revealed. */
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

describe("rules demo, played by mouse-feet", () => {
  /** Where the stepping-stones elements sit on the screen, as jsdom has no layout. */
  const BOXES: Record<string, [number, number, number, number]> = {
    start: [0, 0, 50, 50],
    "lava-2": [100, 0, 150, 50],
    "door-base": [200, 0, 250, 50],
  };

  /** The element at a point, by the boxes. */
  const elementAt = (x: number, y: number): Element | null => {
    const hit = Object.entries(BOXES).find(([, [l, t, r, b]]) => x >= l && x < r && y >= t && y < b);
    return hit ? document.getElementById(hit[0]) : null;
  };

  /** The pointer, on the game viewport. */
  const pointer = {
    move: (x: number, buttons = 0) => fireEvent.pointerMove($("#game-viewport")!, { clientX: x, clientY: 25, buttons }),
    down: (x: number) => fireEvent.pointerDown($("#game-viewport")!, { clientX: x, clientY: 25, button: 0 }),
    up: (x: number) => fireEvent.pointerUp($("#game-viewport")!, { clientX: x, clientY: 25, button: 0 }),
  };

  /** The stepping-stones challenge's run, which a reset moves on. */
  const run = () => $("#door-base")?.closest("[data-scene-run]")?.getAttribute("data-scene-run");

  beforeEach(() => {
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: elementAt });
  });
  afterEach(() => Reflect.deleteProperty(document, "elementFromPoint"));

  /** Opens the stepping-stones stage, lays out its elements, and arms the feet away from them. */
  const openStage = async () => {
    render(
      <GameProviders repository={{ games: { "rules-demo": demo(() => {}) } }} gameId="rules-demo">
        <Game />
      </GameProviders>,
    );
    await waitFor(() => expect($("#demo-title")).not.toBeNull());
    fireEvent.click($("#demo-title")!);
    await waitFor(() => expect($("#stage-link-stepping-stones")).not.toBeNull());
    fireEvent.click($("#stage-link-stepping-stones")!);
    await waitFor(() => expect($("#door-base")).not.toBeNull());
    await wait(3000); // the scene change, during which the feet wait
    expect(receivedLayout.at(-1)!.avatar.mode).toBe("mouse-feet");
    for (const [id, [left, top, right, bottom]] of Object.entries(BOXES)) {
      vi.spyOn($(`#${id}`)!, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top }),
      );
    }
    pointer.move(300);
  };

  it("tells the player to drag to jump", async () => {
    await openStage();
    expect($("#lava-message")).toHaveTextContent("Drag from the start to the door");
  });

  it("resets the challenge when the feet step onto lava", async () => {
    await openStage();
    const before = run();
    pointer.move(120);
    await waitFor(() => expect(run()).not.toBe(before));
  });

  it("completes when the player drags from the start onto the door's base, jumping the lava", async () => {
    await openStage();
    pointer.move(10);
    pointer.down(10);
    pointer.move(120, 1);
    pointer.move(210, 1);
    pointer.up(210);
    await waitFor(() => expect($("#stage-link-stepping-stones")).toHaveClass("completed"));
  });

  it("doesn't complete for a click on the door's base", async () => {
    await openStage();
    pointer.move(210);
    pointer.down(210);
    pointer.up(210);
    fireEvent.click($("#door-base")!);
    await wait(1000);
    expect($("#door-base")).not.toBeNull();
    expect($("#stage-link-stepping-stones")).not.toHaveClass("completed");
  });
});
