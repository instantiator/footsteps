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

/** The floor the demo shows with the default calibration, unmirrored, as a new camera choice is. */
const VIEW: FloorView = {
  corners: DEFAULT_CORNERS,
  crop: cropPlacement(floorCrop(DEFAULT_CORNERS), false),
  mirrored: false,
};

/** Opens the demo's "Walk around" stage, past its scroll; with a camera, a fake one showing a person. */
const openWalkAround = async (page: Page, { camera = true, query = "" } = {}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (camera) {
    await page.context().grantPermissions(["camera"]);
    await installFakeCamera(page, peoplePhotoUrls());
    await installCameraDrawCounter(page);
    await seedCalibration(page);
  }
  await page.goto(`/game/rules-demo/play${query}`);
  await page.locator("#demo-title").click({ force: true });
  await page.locator("#stage-link-depth").click();
  await page.getByLabel("Next page").click();
  await page.locator('input[name="answer"]').fill("walk");
  await expect(page.locator("#depth-far")).toBeVisible();
  if (camera) await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
};

/** The z-index an element computes to. */
const zIndexOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => Number(getComputedStyle(element).zIndex));

/** Where an item's bottom centre is drawn, and how much it is scaled, relative to the viewport. */
const drawnAt = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element: HTMLElement) => {
    const viewport = document.querySelector("#game-viewport")!.getBoundingClientRect();
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

test("outlines the floor, shades what's off it, and marks the player's feet when debugging", async ({ page }) => {
  await openWalkAround(page, { query: "?debug=true" });
  const overlay = page.locator("#debug-overlay-container");
  await expect(overlay.locator("polygon")).toBeAttached();
  await expect(overlay.locator("path.floorOffFloor")).toBeAttached();
  await expect(overlay.locator(".floorMarkerOn, .floorMarkerOff").first()).toBeAttached({ timeout: MODEL_TIMEOUT });

  // The overlay covers the whole camera image, which a 2.5D scene crops: wider than the viewport
  const widths = await page.evaluate(() =>
    ["#game-viewport", "#debug-overlay-container", "#character-canvas-container"].map(
      (selector) => document.querySelector(selector)!.getBoundingClientRect().width,
    ),
  );
  expect(widths[1]).toBeGreaterThan(widths[0]);
  expect(widths[1]).toBeCloseTo(widths[2], 0);
});

/** Where a surface is drawn, as a box around it, relative to the viewport. */
const surfaceBox = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const viewport = document.querySelector("#game-viewport")!.getBoundingClientRect();
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

test("lays Nanny's Magic Trifle's river on the floor, in the overview and in a stage's shared scene", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/game/magic-trifle/play");
  await page.locator("#magic-trifle-title").click({ force: true });
  await expect(page.locator("#stages-link-stage-1")).toBeVisible();

  // The floor's front corners are the viewport's bottom corners, and its back edge is level, part way down
  const river = await surfaceBox(page, "#overview-background-container .floor-background");
  expect(river.left).toBeCloseTo(0, 0);
  expect(river.right).toBeCloseTo(river.width, 0);
  expect(river.bottom).toBeCloseTo(river.height, 0);
  expect(river.top / river.height).toBeCloseTo(floorToViewport(VIEW, { x: 0, y: 0 }).y, 2);

  // The far bank stands on the floor's back edge, with the forest further back, higher up the screen
  const bank = await surfaceBox(page, "#overview-background-container .rear-wall");
  const forest = await surfaceBox(page, "#overview-background-container .rear-background");
  expect(bank.bottom).toBeCloseTo(river.top, 0);
  expect(forest.bottom).toBeLessThan(bank.bottom);
  await expect(page.locator("#overview-background-container .horizon-background")).toBeVisible();

  // The open stone floats, so it never holds still for a normal click
  await page.locator("#stages-link-stage-1").click({ force: true });
  const shared = page.locator("[id^='stage'][id$='-background-container'] .floor-background");
  await expect(shared).toBeVisible();
  const stageRiver = await surfaceBox(page, "[id^='stage'][id$='-background-container'] .floor-background");
  expect(stageRiver.top).toBeCloseTo(river.top, 0);
});
