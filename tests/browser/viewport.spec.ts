import { expect, test } from "@playwright/test";
import { installFakeCamera } from "./fixtures/fakeCamera";

test("eases the game viewport into the camera's shape, then fades the overview in", async ({ page }) => {
  await page.context().grantPermissions(["camera"]);
  await installFakeCamera(page);
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
