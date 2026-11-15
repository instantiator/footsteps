import { expect, test, type Page } from "@playwright/test";
import {
  cropPlacement,
  DEFAULT_CORNERS,
  floorCrop,
  floorToViewport,
  floorWidthRatio,
  type FloorView,
} from "../../src/components/camera/FloorGeometry";
import { MODEL_TIMEOUT, seedCalibration } from "./fixtures/cameraGame";
import { installCameraDrawCounter } from "./fixtures/cameraDraws";
import { installFakeCamera } from "./fixtures/fakeCamera";
import { peoplePhotoUrls } from "./fixtures/people/people";
import type { GameRepository } from "../../src/entities/GameRepository";
import type { GameSpectatorsData } from "../../src/entities/data/scenes/GameSceneData";

/** The floor the demo shows with the default calibration, unmirrored, as a new camera choice is, in its scene box. */
const VIEW: FloorView = {
  corners: DEFAULT_CORNERS,
  crop: cropPlacement(floorCrop(DEFAULT_CORNERS), false),
  mirrored: false,
};

/**
 * Leaves out Walk around's start and its spring, which the fake camera's person can't step on or off: they would
 * hold the room back, or reset it again and again.
 */
const withoutStartOrSpring = async (page: Page, spectators?: GameSpectatorsData) => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const game = repository.games["rules-demo"];
    if (spectators) game.modules = { ...game.modules, spectators };
    const scene = repository.games["rules-demo"].stages
      .find((stage) => stage.id === "depth")!
      .challenges.find((challenge) => challenge.id === "walk-around")!.scenes[0];
    delete scene.resetScene;
    scene.component.rules = scene.component.rules!.filter(
      ({ on }) => !("target" in on) || on.target !== "#depth-spring",
    );
    await route.fulfill({ response, json: repository });
  });
};

/**
 * Opens the demo's "Walk around" stage, past its scroll: with a camera, a fake one showing a person; without one, by
 * mouse-feet, standing on the start.
 */
const openWalkAround = async (
  page: Page,
  {
    camera = true,
    query = "",
    corners = DEFAULT_CORNERS,
    spectators = undefined as GameSpectatorsData | undefined,
  } = {},
) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (camera) {
    await page.context().grantPermissions(["camera"]);
    await installFakeCamera(page, peoplePhotoUrls());
    await installCameraDrawCounter(page);
    await seedCalibration(page, corners);
    await withoutStartOrSpring(page, spectators);
  }
  const params = new URLSearchParams(query);
  if (!camera) params.set("noCamera", "true");
  await page.goto(`/game/rules-demo/play?${params.toString()}`);
  await page.locator("#demo-title").click({ force: true });
  await page.locator("#stage-link-depth").click();
  await page.getByLabel("Next page").click();
  await page.locator('input[name="answer"]').fill("walk");
  if (!camera) await page.locator("#reset-start").hover({ force: true });
  await expect(page.locator("#depth-far")).toBeVisible();
  if (camera) await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
};

/** The z-index an element computes to. */
const zIndexOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => Number(getComputedStyle(element).zIndex));

/** Where an item's bottom centre is drawn, and how much it is scaled, relative to the scene box. */
const drawnAt = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element: HTMLElement) => {
    const viewport = document.querySelector(".floorScene .sceneBox")!.getBoundingClientRect();
    const drawn = element.getBoundingClientRect();
    return {
      x: drawn.left + drawn.width / 2 - viewport.left,
      y: drawn.bottom - viewport.top,
      scale: drawn.width / element.offsetWidth,
      viewport: { width: viewport.width, height: viewport.height },
    };
  });

test("stands each floor item on its floor spot, shrunk by how far back it is", async ({ page }) => {
  await openWalkAround(page, { camera: false });
  for (const [selector, floor] of [
    ["#depth-near", { x: 75, y: 80 }],
    ["#depth-far", { x: 20, y: 30 }],
  ] as const) {
    await expect
      .poll(async () => {
        const { x, y, scale, viewport } = await drawnAt(page, selector);
        const spot = floorToViewport(VIEW, floor);
        const ratio = floorWidthRatio(VIEW, viewport, floor.y);
        return [
          Math.abs(x - spot.x * viewport.width) < 2,
          Math.abs(y - spot.y * viewport.height) < 2,
          Math.abs(scale - ratio) < 0.01,
        ];
      })
      .toEqual([true, true, true]);
  }
});

test("sorts a player among the floor items, in one stacking context", async ({ page }) => {
  await openWalkAround(page);
  const canvas = "#character-canvas-container .player";
  await expect.poll(() => zIndexOf(page, canvas), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(-1000);

  // The photo's person stands about two thirds of the way down the picture: between the far post and the near one
  const [far, near, player] = await Promise.all([
    zIndexOf(page, "#depth-far"),
    zIndexOf(page, "#depth-near"),
    zIndexOf(page, canvas),
  ]);
  expect(far).toBe(-970);
  expect(near).toBe(-920);
  expect(player).toBeGreaterThan(far);
  expect(player).toBeLessThan(near);

  // Nothing between them and the stack may form a stacking context, or the z-indexes wouldn't compare
  const breaks = await page.evaluate(() => {
    const stack = document.querySelector(".depthStack")!;
    const ancestors = (element: Element) => {
      const found: string[] = [];
      for (let node = element.parentElement; node && node !== stack; node = node.parentElement) {
        const style = getComputedStyle(node);
        const positioned = style.position !== "static" && style.zIndex !== "auto";
        if (positioned || style.transform !== "none" || style.opacity !== "1" || style.isolation === "isolate") {
          found.push(node.id || node.className);
        }
      }
      return found;
    };
    return [...ancestors(document.querySelector("#depth-far")!), ...ancestors(document.querySelector(".player")!)];
  });
  expect(breaks).toEqual([]);
});

test("paints a far post behind the player's canvas and a near one in front", async ({ page }) => {
  await openWalkAround(page);
  const canvas = page.locator("#character-canvas-container .player").first();
  await expect
    .poll(() => canvas.evaluate((c) => Number(c.style.zIndex)), { timeout: MODEL_TIMEOUT })
    .toBeGreaterThan(-1000);

  const topmostAt = (selector: string) =>
    page.evaluate((target) => {
      const { left, top, width, height } = document.querySelector(target)!.getBoundingClientRect();
      const canvasElement = document.querySelector<HTMLElement>("#character-canvas-container .player")!;
      canvasElement.style.pointerEvents = "auto"; // the silhouette takes no clicks, so let this check find it
      const stack = document.elementsFromPoint(left + width / 2, top + height / 2);
      canvasElement.style.pointerEvents = "";
      return stack
        .map((element) => element.id || element.tagName)
        .filter((id) => id === target.slice(1) || id === "CANVAS");
    }, selector);

  await expect.poll(() => topmostAt("#depth-far")).toEqual(["CANVAS", "depth-far"]);
  await expect.poll(() => topmostAt("#depth-near")).toEqual(["depth-near", "CANVAS"]);
});

test("keeps an item that isn't on the floor in front of the player, where a click still reaches it", async ({
  page,
}) => {
  await openWalkAround(page);
  const done = page.locator("#depth-done");
  await expect
    .poll(() => zIndexOf(page, "#character-canvas-container .player"), { timeout: MODEL_TIMEOUT })
    .toBeGreaterThan(-1000);

  await expect(done).toHaveCSS("z-index", "auto");
  await done.click();
  await expect(page.locator("#stage-link-depth")).toHaveClass(/completed/);
});

test("shows where player 1 stands, and puts a ring under them", async ({ page }) => {
  await openWalkAround(page);
  const position = page.locator("#depth-position");
  await expect(position).toContainText("Player 1 is at", { timeout: MODEL_TIMEOUT });
  const [, x, y] = /at (-?[\d.]+) across, (-?[\d.]+) forward/.exec((await position.textContent()) ?? "")!.map(Number);
  expect(y).toBeGreaterThan(30);
  expect(y).toBeLessThan(80);
  await expect(page.locator("#depth-ring")).toHaveAttribute("data-floor-x", String(x));
});

test("draws the height of each player's ground point as a line when debugging", async ({ page }) => {
  await openWalkAround(page, { query: "?debug=true" });
  const canvas = page.locator("#character-canvas-container .player").first();
  await expect
    .poll(() => canvas.evaluate((c) => Number(c.style.zIndex)), { timeout: MODEL_TIMEOUT })
    .toBeGreaterThan(-1000);

  const hasDepthLine = () =>
    canvas.locator("canvas").evaluate((element) => {
      const { width, height } = element as HTMLCanvasElement;
      const { data } = (element as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, width, height);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0 && data[i + 1] === 255 && data[i + 2] === 0 && data[i + 3] === 255) return true;
      }
      return false;
    });
  await expect.poll(hasDepthLine).toBe(true);
});

for (const screen of [
  { width: 1600, height: 600 },
  { width: 600, height: 900 },
]) {
  test(`fits the scene box to the floor on a ${screen.width}×${screen.height} screen, and plays in it`, async ({
    page,
  }) => {
    await page.setViewportSize(screen);
    await openWalkAround(page, { camera: false });
    const { box, viewport } = await page.evaluate(() => ({
      box: document.querySelector(".floorScene .sceneBox")!.getBoundingClientRect().toJSON() as DOMRect,
      viewport: document.querySelector("#game-viewport")!.getBoundingClientRect().toJSON() as DOMRect,
    }));
    // The box takes the default floor's crop of a 4:3 image, as large as fits, centred on the screen's bottom edge
    expect(box.width / box.height).toBeCloseTo((0.84 * 4) / 3 / 0.9, 2);
    expect(box.bottom).toBeCloseTo(viewport.bottom, 0);
    expect(box.left - viewport.left).toBeCloseTo(viewport.right - box.right, 0);
    expect(Math.max(box.width / viewport.width, box.height / viewport.height)).toBeCloseTo(1, 2);

    await expect
      .poll(async () => {
        const { x, y, viewport: size } = await drawnAt(page, "#depth-near");
        const spot = floorToViewport(VIEW, { x: 75, y: 80 });
        return Math.abs(x - spot.x * size.width) < 2 && Math.abs(y - spot.y * size.height) < 2;
      })
      .toBe(true);
    await page.locator("#depth-near").hover({ force: true });
    await expect(page.locator("#depth-near")).toHaveClass(/demo-depth-lit/);
  });
}

test("outlines the floor, shades what's off it, and marks the player's feet when debugging", async ({ page }) => {
  await openWalkAround(page, { query: "?debug=true" });
  const overlay = page.locator("#debug-overlay-container");
  await expect(overlay.locator("polygon")).toBeAttached();
  await expect(overlay.locator("path.floorOffFloor")).toBeAttached();
  await expect(overlay.locator(".floorMarkerOn, .floorMarkerOff").first()).toBeAttached({ timeout: MODEL_TIMEOUT });

  // The overlay covers the whole camera image, which a 2.5D scene crops: wider than the scene box
  const widths = await page.evaluate(() =>
    [".floorScene .sceneBox", "#debug-overlay-container", "#character-canvas-container"].map(
      (selector) => document.querySelector(selector)!.getBoundingClientRect().width,
    ),
  );
  expect(widths[1]).toBeGreaterThan(widths[0]);
  expect(widths[1]).toBeCloseTo(widths[2], 0);
});

/** Where a surface is drawn, as a box around it, relative to the scene box. */
const surfaceBox = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const viewport = document.querySelector(".floorScene .sceneBox")!.getBoundingClientRect();
      const drawn = element.getBoundingClientRect();
      return {
        left: drawn.left - viewport.left,
        top: drawn.top - viewport.top,
        right: drawn.right - viewport.left,
        bottom: drawn.bottom - viewport.top,
        width: viewport.width,
        height: viewport.height,
      };
    });

test("tiles Walk around's floor, and springs the player off its spring, back to the start", async ({ page }) => {
  await openWalkAround(page, { camera: false });
  const tilesBox = () =>
    page.locator("[data-floor-area]").evaluateAll((elements) => {
      const viewport = document.querySelector(".floorScene .sceneBox")!.getBoundingClientRect();
      const boxes = elements.map((element) => element.getBoundingClientRect());
      return {
        count: boxes.length,
        left: Math.min(...boxes.map(({ left }) => left)) - viewport.left,
        top: Math.min(...boxes.map(({ top }) => top)) - viewport.top,
        right: Math.max(...boxes.map(({ right }) => right)) - viewport.left,
        bottom: Math.max(...boxes.map(({ bottom }) => bottom)) - viewport.top,
        width: viewport.width,
        height: viewport.height,
      };
    });
  // Every tile is placed within a frame or two of appearing
  const back = floorToViewport(VIEW, { x: 0, y: 0 }).y;
  await expect
    .poll(async () => Math.abs((await tilesBox()).top / (await tilesBox()).height - back))
    .toBeLessThan(0.005);
  const tiles = await tilesBox();
  // Together the tiles cover the floor: its front corners are the scene box's bottom corners
  expect(tiles.count).toBe(16);
  expect(tiles.left).toBeCloseTo(0, 0);
  expect(tiles.right).toBeCloseTo(tiles.width, 0);
  expect(tiles.bottom).toBeCloseTo(tiles.height, 0);

  await page.locator("#depth-spring").hover({ force: true });
  await expect(page.locator("#reset-start")).toBeVisible();
  await expect(page.locator("#depth-far")).toHaveCount(0);
});

test("lays Nanny's Magic Trifle's river on the floor, in the overview and in a stage's shared scene", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/game/magic-trifle/play");
  await page.locator("#magic-trifle-title").click({ force: true });
  await expect(page.locator("#stages-link-stage-1")).toBeVisible();

  // The far bank stands on the floor's back edge, across the whole screen, with the forest just behind it, higher up
  const bank = await surfaceBox(page, "#overview-background-container .rear-wall");
  const forest = await surfaceBox(page, "#overview-background-container .rear-background");
  expect(bank.bottom / bank.height).toBeCloseTo(floorToViewport(VIEW, { x: 0, y: 0 }).y, 2);
  expect(bank.left).toBeLessThan(0);
  expect(bank.right).toBeGreaterThan(bank.width);
  expect(forest.bottom).toBeLessThan(bank.bottom);

  // The river runs from the bottom of the screen back to the horizon, just behind the bank
  const river = await surfaceBox(page, "#overview-background-container .floor-background");
  expect(river.bottom).toBeGreaterThan(river.height);
  expect(river.left).toBeLessThan(0);
  expect(river.top).toBeLessThan(bank.bottom);
  expect(river.top).toBeGreaterThan(forest.bottom - 20);
  await expect(page.locator("#overview-background-container .horizon-background")).toBeVisible();

  // The open stone floats, so it never holds still for a normal click
  await page.locator("#stages-link-stage-1").click({ force: true });
  const shared = page.locator("[id^='stage'][id$='-background-container'] .floor-background");
  await expect(shared).toBeVisible();
  const stageRiver = await surfaceBox(page, "[id^='stage'][id$='-background-container'] .floor-background");
  expect(stageRiver.top).toBeCloseTo(river.top, 0);
});

/** Whether something a scene draws covers each of the screen's corners and the middles of its edges, inside its rounding. */
const screenCovered = (page: Page) =>
  page.locator("#game-viewport").evaluate((viewport) => {
    const { left, top, right, bottom } = viewport.getBoundingClientRect();
    const [xs, ys] = [
      [left + 16, (left + right) / 2, right - 16],
      [top + 16, (top + bottom) / 2, bottom - 16],
    ];
    const drawn = ".screen-background, .horizon-background, .floor-background, .rear-background, .rear-wall";
    return xs.flatMap((x) => ys.map((y) => document.elementsFromPoint(x, y).some((element) => element.matches(drawn))));
  });

for (const screen of [
  { width: 2100, height: 900 },
  { width: 900, height: 1200 },
]) {
  test(`leaves no blank space around either game's scenes on a ${screen.width}×${screen.height} screen`, async ({
    page,
  }) => {
    await page.setViewportSize(screen);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const allCovered = Array<boolean>(9).fill(true);
    await page.goto("/game/magic-trifle/play");
    await expect.poll(() => screenCovered(page)).toEqual(allCovered);
    await page.locator("#magic-trifle-title").click({ force: true });
    await expect(page.locator("#stages-link-stage-1")).toBeVisible();
    await expect.poll(() => screenCovered(page)).toEqual(allCovered);

    await openWalkAround(page, { camera: false });
    await expect.poll(() => screenCovered(page)).toEqual(allCovered);
  });
}

/** A floor across the top of the picture, so the photo's person, two thirds of the way down, stands off it. */
const FLOOR_BEHIND_THE_PERSON = {
  backLeft: { x: 0.25, y: 0.1 },
  backRight: { x: 0.75, y: 0.1 },
  frontRight: { x: 0.9, y: 0.3 },
  frontLeft: { x: 0.1, y: 0.3 },
};

test("hides a person standing off the floor, as a spectator", async ({ page }) => {
  await openWalkAround(page, { corners: FLOOR_BEHIND_THE_PERSON });
  const player = page.locator("#character-canvas-container .player").first();
  await expect(player).toBeAttached({ timeout: MODEL_TIMEOUT });
  await expect(player).toBeHidden();
});

test("draws a spectator with their look, when the game shows them", async ({ page }) => {
  const spectators: GameSpectatorsData = { show: "shown", look: { opacity: 0.4, filter: "grayscale(1)" } };
  await openWalkAround(page, { corners: FLOOR_BEHIND_THE_PERSON, spectators });
  const player = page.locator("#character-canvas-container .player[data-spectator]").first();
  await expect(player).toBeVisible({ timeout: MODEL_TIMEOUT });
  await expect(player).toHaveCSS("opacity", "0.4");
  await expect(player).toHaveCSS("filter", "grayscale(1)");
});
