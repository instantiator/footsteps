import { expect, test, type Page } from "@playwright/test";
import type { GameData } from "../../src/entities/data/GameData";
import type { GameRule } from "../../src/entities/data/scenes/GameSceneData";
import type { GameRepository } from "../../src/entities/GameRepository";
import { MODEL_TIMEOUT } from "./fixtures/cameraGame";
import { installFakeCamera } from "./fixtures/fakeCamera";
import { peoplePhotoUrls } from "./fixtures/people/people";

/** Items for an effect to act on, and buttons for the rules to fire on. */
const ITEMS = `
  <div id="bridge" style="position: absolute; left: 20cqw; top: 40cqh; width: 20cqw; height: 10cqh; background: brown"></div>
  <div id="tilted" style="position: absolute; left: 60cqw; top: 60cqh; width: 10cqw; height: 10cqh; background: blue; transform: rotate(90deg)"></div>
  <div id="platform" style="position: absolute; left: 70cqw; top: 20cqh; width: 10cqw; height: 10cqh; background: green"></div>
  <button id="go" style="position: absolute; left: 1cqw; top: 1cqh">Go</button>
  <button id="again" style="position: absolute; left: 10cqw; top: 1cqh">Again</button>
  <button id="finish" style="position: absolute; left: 20cqw; top: 1cqh">Finish</button>
  <p id="count" style="position: absolute; left: 30cqw; top: 1cqh">{{state.n}}</p>`;

/** The rule that fires when `#go` is clicked. */
const onGo = (actions: GameRule["do"]): GameRule => ({ on: { interact: ["click"], target: "#go" }, do: actions });

/** The rule that fires when `#again` is clicked. */
const onAgain = (actions: GameRule["do"]): GameRule => ({ on: { interact: ["click"], target: "#again" }, do: actions });

/** Serves the example game with one stage's challenge playing these rules, then opens it. */
const openWith = async (page: Page, rules: GameRule[], change: (game: GameData) => void = () => {}) => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const game = repository.games["rules-demo"];
    for (const scene of [
      ...game.scenes,
      // The effects stage acts on players, so it can't load without the camera
      ...game.stages
        .filter((stage) => stage.id !== "effects")
        .flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.scenes)),
    ]) {
      scene.avatar = { mode: "mouse" };
    }
    const stage = game.stages.find(({ id }) => id === "balloons")!;
    const [scene] = stage.challenges[0].scenes;
    delete scene.resetScene;
    scene.component = {
      type: "template",
      data: {},
      initialState: { n: 0 },
      foregroundTemplate: { sourceType: "embedded", content: ITEMS },
      rules: [{ on: { interact: ["click"], target: "#finish" }, do: [{ completeChallenge: true }] }, ...rules],
    };
    change(game);
    await route.fulfill({ response, json: repository });
  });
  await page.goto("/game/rules-demo/play");
  await page.locator("#demo-title").click();
  await page.locator("#stage-link-balloons").click();
  await expect(page.locator("#bridge")).toBeVisible();
};

/** Where an element's centre is, as a % of the scene's width and height. */
const centreOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => {
    const scene = document.querySelector("#game-viewport")!.getBoundingClientRect();
    const { left, top, width, height } = element.getBoundingClientRect();
    return {
      left: ((left + width / 2 - scene.left) / scene.width) * 100,
      top: ((top + height / 2 - scene.top) / scene.height) * 100,
    };
  });

/** Whether an element's top is below the scene. */
const isOffScreen = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => {
    const scene = document.querySelector("#game-viewport")!.getBoundingClientRect();
    return element.getBoundingClientRect().top >= scene.bottom - 1;
  });

/** Waits for an element's animations to finish. */
const settled = (page: Page, selector: string) =>
  page.locator(selector).evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });

const expectNear = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(0.5);

test("a fall ends off the scene, and stays there", async ({ page }) => {
  await openWith(page, [onGo([{ effect: "item-fall", target: "#bridge", durationMs: 100 }])]);
  await page.locator("#go").click();
  await settled(page, "#bridge");
  expect(await isOffScreen(page, "#bridge")).toBe(true);
  await page.waitForTimeout(100);
  expect(await isOffScreen(page, "#bridge")).toBe(true);
});

test("a move places an element's centre, at any size of scene", async ({ page }) => {
  const end = { left: 50, top: 20 };
  await openWith(page, [onGo([{ effect: "item-move", target: "#bridge", durationMs: 100, end }])]);
  await page.locator("#go").click();
  await settled(page, "#bridge");
  const big = await centreOf(page, "#bridge");
  expectNear(big.left, 50);
  expectNear(big.top, 20);

  await page.setViewportSize({ width: 800, height: 400 });
  const small = await centreOf(page, "#bridge");
  expectNear(small.left, 50);
  expectNear(small.top, 20);
});

test("a move in a second column still places its centre by the whole scene", async ({ page }) => {
  const end = { left: 75, top: 20 };
  await openWith(page, [], (game) => {
    const stage = game.stages.find(({ id }) => id === "balloons")!;
    const [first] = stage.challenges;
    const [scene] = first.scenes;
    const second = {
      ...first,
      id: "second",
      scenes: [
        {
          ...scene,
          component: {
            ...scene.component,
            foregroundTemplate: {
              sourceType: "embedded" as const,
              content:
                '<div id="right" style="position: absolute; left: 60cqw; top: 40cqh; width: 5cqw; height: 5cqh; background: pink"></div><button id="right-go" style="position: absolute; left: 60cqw; top: 1cqh">Go</button>',
            },
            rules: [
              {
                on: { interact: ["click" as const], target: "#right-go" },
                do: [{ effect: "item-move" as const, target: "#right", durationMs: 50, end }],
              },
            ],
          },
        },
      ],
    };
    stage.challenges = [first, second];
    stage.challengeChunking = 2;
  });
  await page.locator("#right-go").click();
  await settled(page, "#right");
  const right = await centreOf(page, "#right");
  expectNear(right.left, 75);
  expectNear(right.top, 20);
});

test("a move can go from a start, by an amount, or from another element", async ({ page }) => {
  await openWith(page, [
    onGo([
      {
        effect: "item-move",
        target: "#bridge",
        durationMs: 100,
        start: { left: 5, top: 5 },
        end: { left: 40, top: 40 },
      },
    ]),
    onAgain([
      { effect: "item-move", target: "#bridge", durationMs: 100, end: { by: { left: 10, top: -10 } } },
      { effect: "item-move", target: "#tilted", durationMs: 100, end: { from: "#platform", left: 0, top: 10 } },
    ]),
  ]);
  await page.locator("#go").click();
  await settled(page, "#bridge");
  await page.locator("#again").click();
  await settled(page, "#bridge");
  await settled(page, "#tilted");
  const bridge = await centreOf(page, "#bridge");
  expectNear(bridge.left, 50);
  expectNear(bridge.top, 30);
  const tilted = await centreOf(page, "#tilted");
  expectNear(tilted.left, 75);
  expectNear(tilted.top, 35);
});

test("an effect survives a template re-render", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "item-move", target: "#bridge", durationMs: 100, end: { left: 50, top: 20 } }]),
    onAgain([{ set: { n: "state.n + 1" } }]),
  ]);
  await page.locator("#go").click();
  await settled(page, "#bridge");
  await page.locator("#again").click();
  await expect(page.locator("#count")).toHaveText("1");
  expectNear((await centreOf(page, "#bridge")).left, 50);
});

test("an item's own transform doesn't bend a move", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "item-move", target: "#tilted", durationMs: 100, end: { by: { left: 10, top: 0 } } }]),
  ]);
  const before = await centreOf(page, "#tilted");
  await page.locator("#go").click();
  await settled(page, "#tilted");
  const after = await centreOf(page, "#tilted");
  expectNear(after.left, before.left + 10);
  expectNear(after.top, before.top);
});

test("a move then a fall doesn't snap the item back", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "item-move", target: "#bridge", durationMs: 50, end: { left: 50, top: 20 } }]),
    onAgain([{ effect: "item-fall", target: "#bridge", durationMs: 50 }]),
  ]);
  await page.locator("#go").click();
  await settled(page, "#bridge");
  await page.locator("#again").click();
  await settled(page, "#bridge");
  await page.waitForTimeout(100);
  expect(await isOffScreen(page, "#bridge")).toBe(true);
  expectNear((await centreOf(page, "#bridge")).left, 50);
});

test("a reset puts an item back where its template does", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "item-fall", target: "#bridge", durationMs: 50 }]),
    onAgain([{ resetState: true }]),
  ]);
  const before = await centreOf(page, "#bridge");
  await page.locator("#go").click();
  await settled(page, "#bridge");
  await page.locator("#again").click();
  await expect.poll(() => isOffScreen(page, "#bridge")).toBe(false);
  expectNear((await centreOf(page, "#bridge")).top, before.top);
});

test("an effect after a reset in the same rule moves the rebuilt element", async ({ page }) => {
  await openWith(page, [onGo([{ resetState: true }, { effect: "item-fall", target: "#bridge", durationMs: 50 }])]);
  await page.locator("#bridge").evaluate((element) => element.setAttribute("data-old", "yes"));
  await page.locator("#go").click();
  await expect(page.locator("#bridge[data-old]")).toHaveCount(0);
  await expect.poll(() => isOffScreen(page, "#bridge")).toBe(true);
});

test("a fallen item doesn't snap back into view while its scene fades away", async ({ page }) => {
  await openWith(page, [onGo([{ effect: "item-fall", target: "#bridge", durationMs: 50 }])]);
  await page.locator("#go").click();
  await settled(page, "#bridge");
  await page.locator("#finish").click();
  const stillOff = await page.evaluate(() => {
    const bridge = document.querySelector("#bridge");
    if (bridge === null) return true;
    return (
      bridge.getBoundingClientRect().top >= document.querySelector("#game-viewport")!.getBoundingClientRect().bottom - 1
    );
  });
  expect(stillOff).toBe(true);
});

test("an effect from a start rule waits for its scene to reach the screen", async ({ page }) => {
  await openWith(page, [
    {
      on: { start: true },
      do: [{ effect: "item-move", target: "#bridge", durationMs: 50, end: { left: 50, top: 20 } }],
    },
  ]);
  await expect.poll(async () => (await centreOf(page, "#bridge")).left).toBeCloseTo(50, 0);
});

test("a delayed effect waits, and is dropped if the scene resets first", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "item-fall", target: "#bridge", durationMs: 50, delayMs: 300 }]),
    onAgain([{ resetState: true }]),
  ]);
  await page.locator("#go").click();
  expect(await isOffScreen(page, "#bridge")).toBe(false);
  await page.locator("#again").click();
  await page.waitForTimeout(500);
  expect(await isOffScreen(page, "#bridge")).toBe(false);
});

test("a quake moves each item and ends, leaving it where it was", async ({ page }) => {
  await openWith(page, [onGo([{ effect: "quake", dx: 2, dy: 2, durationMs: 300, cycleMs: 60 }])]);
  const before = await centreOf(page, "#bridge");
  await page.locator("#go").click();
  const running = await page.locator("#bridge").evaluate((element) => element.getAnimations().length);
  expect(running).toBe(1);
  await settled(page, "#bridge");
  expectNear((await centreOf(page, "#bridge")).left, before.left);
});

test("a quake enlarges a full-size item so no gap shows", async ({ page }) => {
  await openWith(page, [onGo([{ effect: "quake", target: "#sky", dx: 2, durationMs: 300 }])], (game) => {
    const [scene] = game.stages.find(({ id }) => id === "balloons")!.challenges[0].scenes;
    scene.component.foregroundTemplate = {
      sourceType: "embedded",
      content: `<div id="sky" style="position: absolute; inset: 0"></div>${ITEMS}`,
    };
  });
  await page.locator("#go").click();
  const scale = await page.locator("#sky").evaluate((element) => {
    const [animation] = element.getAnimations();
    const [frame] = (animation.effect as KeyframeEffect).getKeyframes();
    return Number(frame.scale);
  });
  expect(scale).toBeCloseTo(1.04, 2);
});

test("a highlight plays and returns the element to its own styles", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "highlight", target: "#bridge", sequence: [{ filter: "brightness(2)", durationMs: 200 }] }]),
  ]);
  const filter = () => page.locator("#bridge").evaluate((element) => getComputedStyle(element).filter);
  await page.locator("#go").click();
  expect(await filter()).toBe("brightness(2)");
  await expect.poll(filter).toBe("none");
});

test("a highlight pulses while the mouse is near, until stopped", async ({ page }) => {
  const sequence = [
    { filter: "brightness(2)", durationMs: 100, easing: "ease-in" },
    { filter: "brightness(1)", durationMs: 100, easing: "ease-out" },
  ];
  await openWith(page, [
    {
      on: { interact: ["mouse-enter"], target: "#platform" },
      do: [{ effect: "highlight", target: "#platform", durationMs: "indefinite", sequence }],
    },
    {
      on: { interact: ["mouse-exit"], target: "#platform" },
      do: [{ effect: "stop", target: "#platform", stop: "highlight" }],
    },
  ]);
  const running = () => page.locator("#platform").evaluate((element) => element.getAnimations().length);
  await page.locator("#platform").hover();
  await expect.poll(running).toBe(1);
  await page.waitForTimeout(500);
  expect(await running()).toBe(1);
  await page.locator("#go").hover();
  await expect.poll(running).toBe(0);
});

test("stopping an item effect returns the item", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "item-fall", target: "#bridge", durationMs: 50 }]),
    onAgain([{ effect: "stop", target: "#bridge" }]),
  ]);
  await page.locator("#go").click();
  await settled(page, "#bridge");
  expect(await isOffScreen(page, "#bridge")).toBe(true);
  await page.locator("#again").click();
  await expect.poll(() => isOffScreen(page, "#bridge")).toBe(false);
});

test("an effect's end fires a rule once per element, with its id", async ({ page }) => {
  await openWith(
    page,
    [
      onGo([{ effect: "item-fall", target: "#bridge, #platform", durationMs: 50 }]),
      { on: { effectEnd: "item-fall" }, do: [{ set: { n: "state.n + 1" } }] },
      { on: { effectEnd: "item-fall", target: "#platform" }, do: [{ set: { last: "event.id" } }] },
    ],
    (game) => {
      const [scene] = game.stages.find(({ id }) => id === "balloons")!.challenges[0].scenes;
      scene.component.foregroundTemplate = {
        sourceType: "embedded",
        content: `${ITEMS}<p id="last">{{state.last}}</p>`,
      };
    },
  );
  await page.locator("#go").click();
  await expect(page.locator("#count")).toHaveText("2");
  await expect(page.locator("#last")).toHaveText("platform");
});

test("an effect's end doesn't fire after it was stopped or its scene reset", async ({ page }) => {
  await openWith(page, [
    onGo([{ effect: "item-fall", target: "#bridge", durationMs: 200 }]),
    onAgain([{ effect: "stop", target: "#bridge" }]),
    { on: { interact: ["click"], target: "#count" }, do: [{ resetState: true }] },
    { on: { effectEnd: "item-fall" }, do: [{ set: { n: "state.n + 1" } }] },
  ]);
  await page.locator("#go").click();
  await page.locator("#again").click();
  await page.waitForTimeout(400);
  await expect(page.locator("#count")).toHaveText("0");

  await page.locator("#go").click();
  await page.locator("#count").click();
  await page.waitForTimeout(400);
  await expect(page.locator("#count")).toHaveText("0");
});

test("the bridge sample: a quake, then a fall, then state, each timed from the rule", async ({ page }) => {
  await openWith(page, [
    onGo([
      { effect: "quake", target: "#bridge", dx: 0.5, dy: 0.5, durationMs: 100 },
      { effect: "item-fall", target: "#bridge", durationMs: 50, delayMs: 100 },
      { set: { n: "1" }, delayMs: 300 },
    ]),
  ]);
  await page.locator("#go").click();
  await expect(page.locator("#count")).toHaveText("0");
  await expect(page.locator("#count")).toHaveText("1");
  expect(await isOffScreen(page, "#bridge")).toBe(true);
});

test.describe("for players who prefer reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a fall goes straight to its end, and a quake doesn't play", async ({ page }) => {
    await openWith(page, [
      onGo([{ effect: "item-fall", target: "#bridge", durationMs: 5000 }]),
      onAgain([{ effect: "quake", target: "#platform", dx: 5, durationMs: 5000 }]),
    ]);
    await page.locator("#go").click();
    await expect.poll(() => isOffScreen(page, "#bridge")).toBe(true);
    await page.locator("#again").click();
    await page.waitForTimeout(100);
    expect(await page.locator("#platform").evaluate((element) => element.getAnimations().length)).toBe(0);
  });

  test("an effect's end still fires", async ({ page }) => {
    await openWith(page, [
      onGo([
        { effect: "item-fall", target: "#bridge", durationMs: 5000 },
        { effect: "quake", target: "#platform", dx: 1 },
      ]),
      { on: { effectEnd: "item-fall" }, do: [{ set: { n: "state.n + 1" } }] },
      { on: { effectEnd: "quake" }, do: [{ set: { n: "state.n + 10" } }] },
    ]);
    await page.locator("#go").click();
    await expect(page.locator("#count")).toHaveText("11");
  });
});

test("the demo's effects stage removes a player, says who, and starts again once nobody is left", async ({ page }) => {
  test.setTimeout(MODEL_TIMEOUT + 60_000);
  await page.context().grantPermissions(["camera"]);
  await installFakeCamera(page, peoplePhotoUrls());
  await page.goto("/game/rules-demo/play");
  await page.locator("#demo-title").click();
  await page.locator("#stage-link-effects").click();
  await expect(page.locator(".effects-item.pit")).toBeVisible();
  await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
  const message = page.locator("#effects-message");
  await expect(message).toContainText("1 playing", { timeout: MODEL_TIMEOUT });

  // Puts the pit under the player, so they walk into it, as far as the camera can tell
  await page.locator(".effects-item.pit").evaluate((pit: HTMLElement) => {
    pit.style.left = "0";
    pit.style.top = "0";
    pit.style.width = "100cqw";
    pit.style.height = "100cqh";
    pit.style.zIndex = "1";
  });
  await expect(message).toContainText("0 playing, 1 gone", { timeout: 10_000 });
  await expect(message).toContainText("1 playing", { timeout: 10_000 });
});

test.describe("on players, with a fake camera", () => {
  const PLAYERS =
    '<p id="players" style="position: absolute; left: 40cqw; top: 1cqh">{{game.players.active}}/{{game.players.removed}}/{{game.players.frozen}}</p>';

  /** Opens the challenge with the camera on, and a person in shot. */
  const openWithPlayer = async (page: Page, rules: GameRule[]) => {
    test.setTimeout(MODEL_TIMEOUT + 60_000);
    await page.context().grantPermissions(["camera"]);
    await installFakeCamera(page, peoplePhotoUrls());
    await openWith(page, rules, (game) => {
      const [scene] = game.stages.find(({ id }) => id === "balloons")!.challenges[0].scenes;
      scene.avatar = { mode: "camera", fallback: "mouse" };
      scene.component.foregroundTemplate = { sourceType: "embedded", content: `${ITEMS}${PLAYERS}` };
    });
    await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
    await expect(page.locator(".player-1")).toHaveCount(1, { timeout: MODEL_TIMEOUT });
    await expect(page.locator("#players")).toHaveText("1/0/0");
  };

  /** A summary of the image on the first player's canvas, to tell whether it has changed. */
  const imageOf = (page: Page) =>
    page.locator(".player-1 canvas").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      return data.reduce((sum, value) => (sum + value) % 1_000_003, 0);
    });

  test("a fall removes them, resets the scene when nobody is left, and brings them back", async ({ page }) => {
    await openWithPlayer(page, [
      onGo([{ effect: "player-fall", players: "all", durationMs: 200 }]),
      { on: { when: "game.players.active == 0 and game.players.removed > 0", forMs: 300 }, do: [{ resetState: true }] },
    ]);
    await page.locator("#go").click();
    await expect(page.locator("#players")).toHaveText("0/1/0");
    const wrapper = await page.locator(".player-1").evaluate((element) => element.getAnimations().length);
    expect(wrapper).toBe(1);
    await expect(page.locator("#players")).toHaveText("1/0/0", { timeout: 5000 });
    expect(await page.locator(".player-1").evaluate((element) => element.getAnimations().length)).toBe(0);
  });

  test("a removed player stays removed when the model loses them and finds them again", async ({ page }) => {
    await openWithPlayer(page, [onGo([{ effect: "player-fall", players: "all", durationMs: 100 }])]);
    await page.locator("#go").click();
    await expect(page.locator("#players")).toHaveText("0/1/0");
    await page.evaluate(() => window.__fakeCamera.setImage("room"));
    await page.waitForTimeout(1500); // long enough for the tracker to give up on them
    await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
    await page.waitForTimeout(1500);
    await expect(page.locator("#players")).toHaveText("0/1/0");
  });

  test("a frozen player's image stays still, and follows the camera again once unfrozen", async ({ page }) => {
    await openWithPlayer(page, [
      onGo([{ effect: "player-freeze", players: "all" }]),
      onAgain([{ effect: "player-unfreeze", players: "all" }]),
    ]);
    await page.locator("#go").click();
    await expect(page.locator("#players")).toHaveText("1/0/1");
    await imageOf(page); // the browser's first read of a canvas can round differently from later ones
    const frozen = await imageOf(page);
    await page.evaluate(() => window.__fakeCamera.setImage("photo:active-runner-forest"));
    await page.waitForTimeout(1000);
    expect(await imageOf(page)).toBe(frozen);

    await page.locator("#again").click();
    await expect(page.locator("#players")).toHaveText("1/0/0");
    await expect.poll(() => imageOf(page), { timeout: 5000 }).not.toBe(frozen);
  });

  test("a spin away takes them off the scene, and a restore brings them back", async ({ page }) => {
    await openWithPlayer(page, [
      onGo([{ effect: "player-spin-away", players: "all", durationMs: 200, zoom: 2, opacity: 0 }]),
      onAgain([{ effect: "player-restore", players: "all", durationMs: 100 }]),
    ]);
    await page.locator("#go").click();
    await expect(page.locator("#players")).toHaveText("0/1/0");
    await page.locator("#again").click();
    await expect(page.locator("#players")).toHaveText("1/0/0");
  });

  test("static shows over a frozen image, flickering, and comes off cleanly", async ({ page }) => {
    await openWithPlayer(page, [
      onGo([
        { effect: "player-freeze", players: "all" },
        { effect: "player-static", players: "all", proportion: 0.9, pixelSize: 2, easeMs: 0 },
      ]),
      onAgain([{ effect: "stop", players: "all", stop: "player-static" }]),
    ]);
    await page.locator("#go").click();
    await expect(page.locator("#players")).toHaveText("1/0/1");
    const withStatic = await imageOf(page);
    await expect.poll(() => imageOf(page)).not.toBe(withStatic); // it flickers, on a frozen image too

    await page.locator("#again").click();
    await page.waitForTimeout(300);
    const afterwards = await imageOf(page);
    await page.waitForTimeout(300);
    expect(await imageOf(page)).toBe(afterwards); // frozen and clean again, so no longer changing
  });

  test("a player with all static is drawn with nothing, and is still active", async ({ page }) => {
    await openWithPlayer(page, [onGo([{ effect: "player-static", players: "all", proportion: 1, easeMs: 0 }])]);
    await page.locator("#go").click();
    await page.waitForTimeout(500);
    await expect(page.locator("#players")).toHaveText("1/0/0");
    const anyVisible = await page.locator(".player-1 canvas").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      return data.some((value, index) => index % 4 === 3 && value > 0);
    });
    expect(anyVisible).toBe(false);
  });

  test("a quake and a filter highlight stay on a player", async ({ page }) => {
    await openWithPlayer(page, [
      onGo([
        { effect: "quake", target: ".player-1", dx: 1, durationMs: "indefinite" },
        { effect: "highlight", target: ".player-1", durationMs: "indefinite", sequence: [{ filter: "brightness(2)" }] },
      ]),
      onAgain([{ effect: "stop", target: ".player" }]),
    ]);
    const running = () => page.locator(".player-1").evaluate((element) => element.getAnimations().length);
    await page.locator("#go").click();
    await expect.poll(running).toBe(2);
    await page.locator("#again").click();
    await expect.poll(running).toBe(0);
  });

  test("a reward starts from the player's body", async ({ page }) => {
    await openWithPlayer(page, [onGo([{ reward: { animation: "stars" }, target: ".player-1" }])]);
    const body = await page
      .locator(".player-1")
      .evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
    await page.locator("#go").click();
    const burst = page.locator('[id^="reward-burst-"]');
    await expect(burst).toHaveCount(1);
    const left = await burst.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
    // The photo's person isn't in the middle of the scene, unlike the centre of their canvas
    expect(left).not.toBeCloseTo(body.left + body.width / 2, -1);
  });
});
