import { expect, test } from "@playwright/test";
import { openCameraGame } from "./fixtures/cameraGame";
import { installFakeCamera } from "./fixtures/fakeCamera";
import type { GameRepository } from "../../src/entities/GameRepository";

test("eases the game viewport into the camera's shape, then fades the overview in", async ({ page }) => {
  await page.context().grantPermissions(["camera"]);
  await installFakeCamera(page);
  // A 2D scene takes the camera's shape; the game is 2.5D, which takes its floor's
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    repository.games["magic-trifle"].modules = { ...repository.games["magic-trifle"].modules, scene: "2D" };
    await route.fulfill({ response, json: repository });
  });
  await page.goto("/game/magic-trifle/play");

  const viewport = page.locator("#game-viewport");
  const scene = page.locator(".gameScene");
  const cameraLayer = page.locator("#character-camera-layer");
  const title = page.locator("#magic-trifle-title");
  const firstStage = page.locator("#stages-link-stage-1");

  const ratioOf = () =>
    viewport.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width / bounds.height;
    });
  const opacityOf = () => scene.evaluate((element) => getComputedStyle(element).opacity);
  const videoRatioOf = () =>
    page.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>("#character-camera-layer video")!;
      return video.videoWidth / video.videoHeight;
    });

  // The title has no camera; the stepping-stones overview turns it on
  const containerRatio = await ratioOf();
  await title.click({ force: true });

  // The viewport takes the container's shape first, then eases towards the camera's over two seconds
  await expect(viewport).toHaveClass(/gameViewportReshaping/);
  await expect(cameraLayer).toHaveCSS("visibility", "hidden");
  await page.waitForTimeout(800);
  const midwayRatio = await ratioOf();
  const cameraRatio = await videoRatioOf();
  expect(cameraRatio).toBeGreaterThan(0);
  expect(Math.abs(containerRatio - cameraRatio)).toBeGreaterThan(0.1);
  expect(midwayRatio).toBeLessThan(containerRatio - 0.02);
  expect(midwayRatio).toBeGreaterThan(cameraRatio + 0.02);

  // The overview arrives when the reshape ends, then fades in over the final second
  await expect(firstStage).toBeVisible();
  await expect(title).toHaveCount(0);
  await expect(viewport).not.toHaveClass(/gameViewportReshaping/);
  await expect.poll(opacityOf).toBe("1");
  await expect(cameraLayer).toHaveCSS("visibility", "visible");

  // The whole viewport matches the camera, and every stepping stone sits inside it
  const measured = await page.evaluate(() => {
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
    };
    const viewportElement = document.querySelector("#game-viewport")!;
    return {
      viewport: rect(viewportElement),
      stones: [...document.querySelectorAll("[id^=stages-link-stage-]")].map((stone) => rect(stone)),
    };
  });

  const viewportWidth = measured.viewport.right - measured.viewport.left;
  const viewportHeight = measured.viewport.bottom - measured.viewport.top;
  expect(viewportWidth / viewportHeight).toBeCloseTo(cameraRatio, 2);

  for (const stone of measured.stones) {
    expect(stone.left).toBeGreaterThanOrEqual(measured.viewport.left - 1);
    expect(stone.right).toBeLessThanOrEqual(measured.viewport.right + 1);
    expect(stone.top).toBeGreaterThanOrEqual(measured.viewport.top - 1);
    expect(stone.bottom).toBeLessThanOrEqual(measured.viewport.bottom + 1);
  }
});

test("fits a 2.5D scene's viewport to the floor, cropping the camera, and its elements still take clicks", async ({
  page,
}) => {
  await openCameraGame(page, { sceneMode: "2.5D" });
  await page.locator("#magic-trifle-title").click({ force: true });
  const firstStage = page.locator("#stages-link-stage-1");
  await expect(firstStage).toBeVisible();
  await expect(page.locator("#character-canvas-container canvas").first()).toBeAttached();

  const measured = await page.evaluate(() => {
    const size = (selector: string) => {
      const { width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return { width, height };
    };
    return { viewport: size("#game-viewport"), stack: size("#character-canvas-container") };
  });
  // The default floor spans 8–92% of the fake camera's 4:3 image, down to 90%
  expect(measured.viewport.width / measured.viewport.height).toBeCloseTo((0.84 * 4) / 3 / 0.9, 2);
  expect(measured.stack.width).toBeCloseTo(measured.viewport.width / 0.84, 0);
  expect(measured.stack.height).toBeCloseTo(measured.viewport.height / 0.9, 0);

  // The stage links float, so a plain click never sees them as stable
  await firstStage.click({ force: true });
  await expect(page.getByRole("button", { name: "Close challenge" })).toBeVisible();
});
