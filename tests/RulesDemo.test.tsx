import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import localRepository from "../public/game-repository.json";
import type { CameraInteraction } from "../src/components/camera/PlayerMonitor";
import Game from "../src/components/core/Game";
import { resetSceneOf, resolveNamedResets } from "../src/components/core/logic/NamedResets";
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
 * The committed rules demo, with its templates inlined. It is played with the camera off (`noCamera`), as jsdom has
 * none: scenes use their fallback modes, and the rules the camera can fire don't depend on it.
 */
const demo = (change: (game: GameData) => void): GameData => {
  const game = resolveNamedResets(structuredClone((localRepository as GameRepository).games["rules-demo"]));
  change(game);
  const withResets = (scene: GameResetScene | GameSceneBase): (GameResetScene | GameSceneBase)[] => {
    const reset = resetSceneOf(scene);
    return reset ? [scene, ...withResets(reset)] : [scene];
  };
  for (const scene of [
    ...game.scenes,
    ...game.stages.flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.scenes)),
  ].flatMap(withResets)) {
    if (scene.component.type !== "template") continue;
    scene.component.foregroundTemplate = inline(scene.component.foregroundTemplate);
    scene.component.backgroundTemplate = inline(scene.component.backgroundTemplate);
  }
  return game;
};

/** Plays without the camera, which jsdom doesn't have. */
const NO_CAMERA = { noCamera: true };

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
    (r) => r.selector && element?.matches(r.selector) && r.interactions.includes(interaction),
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
      <GameProviders repository={{ games: { "rules-demo": demo(change) } }} gameId="rules-demo" config={NO_CAMERA}>
        <Game />
      </GameProviders>,
    );
    await waitFor(() => expect($("#demo-title")).not.toBeNull());
    fireEvent.click($("#demo-title")!);
    await waitFor(() => expect($("#candle-left")).not.toBeNull());
  };

  it("lights a candle when a hand is over its tip", async () => {
    await start();
    expect($("#candle-left")).not.toHaveClass("lit");
    touch("#candle-left-tip", "hand-enter");
    await waitFor(() => expect($("#candle-left")).toHaveClass("lit"));
    expect($("#candle-right")).not.toHaveClass("lit");
  });

  /** Enters the balloons stage, stands on the shared reset's Start, and waits out its countdown. */
  const startBalloons = async () => {
    touch("#stage-link-balloons", "hand-enter");
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Stand on Start"));
    touch("#reset-start", "foot-enter");
    await waitFor(() => expect($("#reset-count")).toHaveTextContent("3"));
    await wait(1000);
    expect($("#reset-count")).toHaveTextContent("2");
    await wait(2000);
    await waitFor(() => expect($("#balloon-0")).not.toBeNull());
  };

  it("keeps the shared reset showing until Start is touched, then counts 3-2-1", async () => {
    await start();
    touch("#stage-link-balloons", "hand-enter");
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Stand on Start"));
    await wait(1500);
    expect($("#reset-count")).toBeNull();

    touch("#reset-start", "foot-enter");
    await waitFor(() => expect($("#reset-count")).toHaveTextContent("3"));
    await wait(1000);
    expect($("#reset-count")).toHaveTextContent("2");
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

  /** Stands on the pits' reset scene's start, and waits for the floor to be revealed. */
  const returnToStart = async () => {
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Stand on Start, or put your mouse on it"));
    touch("#reset-start", "foot-enter");
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Get ready!"));
    await wait(3000);
    await waitFor(() => expect($("#door-base")).not.toBeNull());
  };

  it("asks for the start before the pits, sends a player who falls in back after the fall, and completes at the door", async () => {
    await start();
    touch("#stage-link-pits", "hand-enter");
    await returnToStart();

    touch("#pit-2", "foot-enter");
    touch("#door-base", "foot-enter"); // too late: they are already falling
    // With nobody in view to fall, the fall ends at once, and the reset follows its 500 ms pause
    await wait(200);
    expect($("#pit-2")).not.toBeNull();
    await returnToStart();
    touch("#door-base", "foot-enter");

    await waitFor(() => expect($("#stage-link-pits")).toHaveClass("completed"));
  });

  it("asks for the start before walking around, and springs the player back to it from the spring", async () => {
    await start();
    touch("#stage-link-depth", "hand-enter");
    await waitFor(() => expect($("[aria-label='Next page']")).not.toBeNull());
    fireEvent.click($("[aria-label='Next page']")!);
    await waitFor(() => expect($("input[name='answer']")).not.toBeNull());
    fireEvent.change($("input[name='answer']")!, { target: { value: "walk" } });
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Stand on Start"));
    touch("#reset-start", "foot-enter");
    await wait(3000);
    await waitFor(() => expect($("#depth-spring")).not.toBeNull());

    touch("#depth-spring", "foot-enter");
    // The reset follows the spin and a 500 ms pause; with nobody in view to spin, only the pause
    await wait(200);
    expect($("#reset-start")).toBeNull();
    await waitFor(() => expect($("#reset-start")).not.toBeNull(), { timeout: 3000 });
  });

  it("collects a ring a hand touches, and brings the next one", async () => {
    await start();
    touch("#stage-link-rings", "hand-enter");
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Stand on Start"));
    touch("#reset-start", "foot-enter");
    await wait(3000);
    await waitFor(() => expect($("#ring-0")).not.toBeNull());
    expect($(".rings-scroll")).toHaveTextContent("Collected 0 rings");

    // jsdom lacks the Web Animations API: this stand-in records what was animated, and never finishes
    const animated: string[] = [];
    Element.prototype.animate = vi.fn<Element["animate"]>(function (this: Element) {
      animated.push(this.id);
      const animation = Object.assign(new EventTarget(), {
        onfinish: null as Animation["onfinish"],
        cancel: vi.fn(),
        persist: vi.fn(),
        finish: vi.fn(),
      });
      return animation as EventTarget & Pick<Animation, "cancel" | "persist" | "onfinish" | "finish"> as Animation;
    });
    onTestFinished(() => void Reflect.deleteProperty(Element.prototype, "animate"));

    touch("#ring-0", "hand-enter");

    await waitFor(() => expect(animated).toContain("ring-gone-1"));
    await waitFor(() => expect($("#ring-1")).not.toBeNull());
    expect($(".rings-scroll")).toHaveTextContent("Collected 1 ring");
    expect($("#ring-gone-1")).not.toBeNull();
  });

  it("a hand touching a floating item fires it, and a foot on a tile fires its rule", async () => {
    await start();
    touch("#stage-link-effects", "hand-enter");
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Stand on Start"));
    touch("#reset-start", "foot-enter");
    await wait(3000);
    await waitFor(() => expect($("#crate")).not.toBeNull());

    // jsdom lacks the Web Animations API: this stand-in records what was animated, and never finishes
    const animated: string[] = [];
    Element.prototype.animate = vi.fn<Element["animate"]>(function (this: Element) {
      animated.push(this.id);
      const animation = Object.assign(new EventTarget(), {
        onfinish: null as Animation["onfinish"],
        cancel: vi.fn(),
        persist: vi.fn(),
        finish: vi.fn(),
      });
      return animation as EventTarget & Pick<Animation, "cancel" | "persist" | "onfinish" | "finish"> as Animation;
    });
    onTestFinished(() => void Reflect.deleteProperty(Element.prototype, "animate"));

    touch("#crate", "hand-enter");
    await waitFor(() => expect(animated).toContain("crate"));
    touch("#restore", "foot-enter");
    await waitFor(() => expect($("#effects-message")).toHaveTextContent("Restored"));
  });

  it("asks the camera not to count covered elements, as clicks don't", async () => {
    await start();
    expect(receivedLayout.at(-1)!.cameraRules!.every((rule) => !rule.includeCovered)).toBe(true);
  });
});

// Trips back to the start wait in real time (up to 3 s each), too close to the default 5 s under a busy full suite
describe("rules demo, the bridge across lava, played by mouse-feet", { timeout: 15_000 }, () => {
  /** Where each element sits on the screen, as jsdom has no layout; later ones are drawn on top. */
  const BOXES: [string, [number, number, number, number]][] = [
    ["lava", [0, 0, 1000, 1000]],
    ["reset-start", [0, 0, 50, 50]],
    ["bridge-1", [0, 0, 50, 50]],
    ["bridge-2", [100, 0, 150, 50]],
    ["bridge-3", [200, 0, 250, 50]],
    ["bridge-4", [300, 0, 350, 50]],
    ["bridge-5", [400, 0, 450, 50]],
    ["door", [420, 0, 430, 50]],
  ];
  const SECTIONS = [25, 125, 225, 325, 405]; // the last is clear of the door, which stands in it
  const [DOOR, LAVA] = [425, 700];
  const SECTION = (n: number) => SECTIONS[n - 1];

  /** The topmost element at a point, by the boxes. */
  const elementAt = (x: number, y: number): Element | null => {
    const hits = BOXES.filter(([id, [l, t, r, b]]) => {
      const element = document.getElementById(id);
      // A fallen section is hidden, and one yet to appear (or still appearing) takes no feet, so none is there to touch
      const absent = ["gone", "unseen", "appearing"].some((name) => element?.classList.contains(name));
      return element && !absent && x >= l && x < r && y >= t && y < b;
    });
    const top = hits.at(-1);
    return top ? document.getElementById(top[0]) : null;
  };

  /** Puts the mouse's feet at a place across the game viewport. */
  const moveTo = (x: number) => fireEvent.pointerMove($("#game-viewport")!, { clientX: x, clientY: 25, buttons: 0 });

  /** The elements the item effects have animated, by id, once for each animation. */
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
    // jsdom has no Web Animations, which item effects play with; each ends when its duration has passed
    Element.prototype.animate = vi.fn<Element["animate"]>(function (this: Element, _keyframes, options) {
      animated.push(this.id);
      const animation: Pick<Animation, "cancel" | "persist" | "onfinish" | "finish"> = {
        cancel: vi.fn(),
        persist: vi.fn(),
        finish: vi.fn(),
        onfinish: null,
      };
      const playing = Object.assign(new EventTarget(), animation) as EventTarget & typeof animation as Animation;
      const durationMs = typeof options === "object" ? Number(options.duration ?? 0) : 0;
      setTimeout(() => playing.onfinish?.call(playing, new Event("finish") as AnimationPlaybackEvent), durationMs);
      return playing;
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "elementFromPoint");
    Reflect.deleteProperty(Element.prototype, "animate");
    vi.restoreAllMocks();
  });

  /** Puts the mouse on the reset scene's Start, and waits out its countdown for the bridge. */
  const returnToStart = async () => {
    await waitFor(() => expect($("#reset-message")).toHaveTextContent("Stand on Start"), { timeout: 3000 });
    await wait(3000); // the scene change, during which the feet wait
    moveTo(LAVA);
    moveTo(SECTION(1));
    await waitFor(() => expect($("#reset-count")).not.toBeNull());
    await wait(3500);
    await waitFor(() => expect($("#bridge-1")).not.toBeNull());
  };

  /** Opens the bridge stage, and stands on the first section. */
  const openStage = async () => {
    render(
      <GameProviders repository={{ games: { "rules-demo": demo(() => {}) } }} gameId="rules-demo" config={NO_CAMERA}>
        <Game />
      </GameProviders>,
    );
    await waitFor(() => expect($("#demo-title")).not.toBeNull());
    fireEvent.click($("#demo-title")!);
    await waitFor(() => expect($("#stage-link-bridge-across-lava")).not.toBeNull());
    fireEvent.click($("#stage-link-bridge-across-lava")!);
    await returnToStart();
    expect(receivedLayout.at(-1)!.avatar).toMatchObject({ mode: "camera", fallback: "mouse-feet" });
  };

  /** Walks on to a later section, and waits for the one left behind to quake, fall and go. */
  const walkTo = async (n: number) => {
    moveTo(SECTION(n));
    await wait(2500);
  };

  /** Ends section 4's appearance, which jsdom has no animations to do. */
  const solidify4 = async () => {
    // jsdom has no AnimationEvent, so the event is made by hand, under the name React listens for there
    const ended = Object.assign(new Event("webkitAnimationEnd", { bubbles: true }), { animationName: "appear-static" });
    fireEvent($("#bridge-4")!, ended);
    await waitFor(() => expect($("#bridge-4")).not.toHaveClass("appearing"));
  };

  it("hides section 4 as lava until section 3 is reached, then shows it appearing, and solid once it ends", async () => {
    await openStage();
    expect($("#bridge-4")).toHaveClass("unseen");
    expect($("#bridge-4")).not.toHaveClass("appearing");

    await walkTo(2);
    expect($("#bridge-4")).toHaveClass("unseen");
    await walkTo(3);
    expect($("#bridge-4")).toHaveClass("appearing");
    expect($("#bridge-4")).not.toHaveClass("unseen");

    // Until the static ends, a foot where it is is on lava
    moveTo(LAVA);
    moveTo(SECTION(4));
    await waitFor(() => expect($(".bridge-glow")).not.toBeNull());
    moveTo(SECTION(3));
    await waitFor(() => expect($(".bridge-glow")).toBeNull());

    await solidify4();
    moveTo(LAVA);
    moveTo(SECTION(4)); // now a section like the others
    await waitFor(() => expect($(".bridge-glow")).toBeNull());
  });

  it("walks the bridge section by section, and each section left quakes then falls", async () => {
    await openStage();
    expect(animated).toEqual([]);

    // Reduced motion, which tests run in, skips the quake, so what shows is the fall
    await walkTo(2);
    expect(animated).toEqual(["bridge-1"]);
    await waitFor(() => expect($("#bridge-1")).toHaveClass("gone"));
    expect($("#bridge-2")).not.toHaveClass("gone");

    await walkTo(3);
    await solidify4();
    for (const n of [4, 5]) await walkTo(n);
    await waitFor(() => expect($("#bridge-4")).toHaveClass("gone"));
    expect($("#bridge-5")).not.toHaveClass("gone");
    expect(animated).toEqual(["bridge-1", "bridge-2", "bridge-3", "bridge-4"]);
  });

  it("a foot on lava for under 2 s shows the warning, which clears on return", async () => {
    await openStage();
    expect($(".bridge-glow")).toBeNull();

    moveTo(LAVA);
    await waitFor(() => expect($(".bridge-glow")).not.toBeNull());
    expect($("#bridge-message")).toHaveTextContent("Get off the lava");
    await wait(1000);

    moveTo(SECTION(1));
    await waitFor(() => expect($(".bridge-glow")).toBeNull());
    await wait(2000); // past the 2 s it would have taken to fall
    expect($("#reset-message")).toBeNull();
  });

  it("a foot on lava for 2 s falls and resets", async () => {
    await openStage();
    moveTo(LAVA);
    await wait(1500);
    expect($("#reset-message")).toBeNull();

    await wait(700); // the hold, then the fall, which ends at once for a player nobody can see
    await returnToStart();
    expect($(".bridge-glow")).toBeNull();
  });

  it("the door completes only from section 5", async () => {
    await openStage();
    moveTo(DOOR);
    await wait(1500);
    fireEvent.click($("#door")!);
    await wait(500);
    expect($("#stage-link-bridge-across-lava")).toBeNull(); // still in the stage, so not back on the overview

    for (const n of [2, 3]) await walkTo(n);
    await solidify4();
    for (const n of [4, 5]) await walkTo(n);
    moveTo(DOOR);
    await wait(1500);
    expect($(".bridge-glow")).toBeNull(); // the door stands on the bridge, so reaching it never touches lava
    await waitFor(() => expect($("#stage-link-bridge-across-lava")).toHaveClass("completed"));
  });

  it("a fallen section no longer counts as safe", async () => {
    await openStage();
    await walkTo(2);
    await waitFor(() => expect($("#bridge-1")).toHaveClass("gone"));

    moveTo(LAVA);
    moveTo(SECTION(1)); // where the first section was, now lava
    await waitFor(() => expect($(".bridge-glow")).not.toBeNull());
  });
});
