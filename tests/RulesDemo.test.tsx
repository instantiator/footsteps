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
 * The committed rules demo, with its templates inlined and the camera itself off (other modes stay): jsdom has no
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
    if (scene.avatar?.mode === "camera") scene.avatar = { mode: "mouse" };
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

describe("rules demo, stone hop, played by mouse-feet", () => {
  /** Where each element sits on the screen, as jsdom has no layout; later ones are drawn on top. */
  const BOXES: [string, [number, number, number, number]][] = [
    ["lava", [0, 0, 1000, 1000]],
    ["stone-1", [0, 0, 50, 50]],
    ["reset-start", [0, 0, 50, 50]],
    ["stone-2", [100, 0, 150, 50]],
    ["stone-3", [200, 0, 250, 50]],
    ["door", [220, 0, 230, 50]],
  ];
  const [STONE_1, STONE_2, STONE_3, DOOR, LAVA] = [25, 125, 210, 225, 500];

  /** The topmost element at a point, by the boxes. */
  const elementAt = (x: number, y: number): Element | null => {
    const hits = BOXES.filter(
      ([id, [l, t, r, b]]) => document.getElementById(id) && x >= l && x < r && y >= t && y < b,
    );
    const top = hits.at(-1);
    return top ? document.getElementById(top[0]) : null;
  };

  /** The pointer, on the game viewport. */
  const pointer = {
    move: (x: number, buttons = 0) => fireEvent.pointerMove($("#game-viewport")!, { clientX: x, clientY: 25, buttons }),
    down: (x: number) => fireEvent.pointerDown($("#game-viewport")!, { clientX: x, clientY: 25, button: 0 }),
    up: (x: number) => fireEvent.pointerUp($("#game-viewport")!, { clientX: x, clientY: 25, button: 0 }),
    /** A jump: press, drag through `via` (eg. across lava), and release. */
    jump: (from: number, to: number, via = (from + to) / 2) => {
      pointer.down(from);
      pointer.move(via, 1);
      pointer.move(to, 1);
      pointer.up(to);
    },
  };

  /** The elements the item effects have animated, by id. */
  const animated: string[] = [];

  beforeEach(() => {
    animated.length = 0;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: elementAt });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const box = BOXES.find(([id]) => id === this.id)?.[1];
      return box
        ? DOMRect.fromRect({ x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] })
        : DOMRect.fromRect({ width: 0, height: 0 });
    });
    // jsdom has no Web Animations, which item effects play with
    Element.prototype.animate = vi.fn<Element["animate"]>(function (this: Element) {
      animated.push(this.id);
      const animation: Pick<Animation, "cancel" | "persist" | "onfinish" | "finish"> = {
        cancel: vi.fn(),
        persist: vi.fn(),
        finish: vi.fn(),
        onfinish: null,
      };
      return Object.assign(new EventTarget(), animation) as EventTarget & typeof animation as Animation;
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "elementFromPoint");
    Reflect.deleteProperty(Element.prototype, "animate");
    vi.restoreAllMocks();
  });

  /** Puts the mouse on the reset scene's first stone, and waits for the stones. */
  const returnToStart = async () => {
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Put your mouse on the first stone"));
    await wait(3000); // the scene change, during which the feet wait
    pointer.move(LAVA);
    pointer.move(STONE_1);
    await waitFor(() => expect($("#stone-1")).not.toBeNull());
    await wait(3000);
  };

  /** Opens stone hop, and stands on the first stone. */
  const openStage = async () => {
    render(
      <GameProviders repository={{ games: { "rules-demo": demo(() => {}) } }} gameId="rules-demo">
        <Game />
      </GameProviders>,
    );
    await waitFor(() => expect($("#demo-title")).not.toBeNull());
    fireEvent.click($("#demo-title")!);
    await waitFor(() => expect($("#stage-link-stone-hop")).not.toBeNull());
    fireEvent.click($("#stage-link-stone-hop")!);
    await returnToStart();
    expect(receivedLayout.at(-1)!.avatar.mode).toBe("mouse-feet");
  };

  it("tells the player to drag between the stones", async () => {
    await openStage();
    expect($("#stones-message")).toHaveTextContent("Drag from the first stone to the second");
  });

  it("sends the player back to the start for walking onto the lava", async () => {
    await openStage();
    pointer.move(LAVA);
    await returnToStart();
  });

  it("drops each stone as the player jumps on, over the lava, and opens the door on the last", async () => {
    await openStage();
    pointer.jump(STONE_1, STONE_2, LAVA);
    await waitFor(() => expect(animated).toEqual(["stone-1"]));
    pointer.jump(STONE_2, STONE_3, LAVA);
    await waitFor(() => expect($("#door")).toHaveClass("open"));
    expect(animated).toEqual(["stone-1", "stone-2"]);
    expect($("#reset-message")).toBeNull();

    pointer.move(DOOR);
    fireEvent.click($("#door")!);
    await waitFor(() => expect($("#stage-link-stone-hop")).toHaveClass("completed"));
  });

  it("sends the player back for jumping from the first stone straight to the last, or into the lava", async () => {
    await openStage();
    pointer.jump(STONE_1, STONE_3);
    await returnToStart();
    pointer.jump(STONE_1, LAVA);
    await returnToStart();
  });

  it("keeps the door shut to a click until the player stands on the last stone", async () => {
    await openStage();
    fireEvent.click($("#door")!);
    await wait(1000);
    expect($("#door")).not.toHaveClass("open");
    expect($("#stage-link-stone-hop")).not.toHaveClass("completed");
  });
});
