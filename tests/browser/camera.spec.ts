import { expect, test, type Page } from "@playwright/test";
import { MODEL_TIMEOUT, openCameraGame } from "./fixtures/cameraGame";

const streamCount = (page: Page) => page.evaluate(() => window.__fakeCamera.streams.length);
const trackState = (page: Page, index: number) =>
  page.evaluate((i) => window.__fakeCamera.streams[i]?.getVideoTracks()[0]?.readyState, index);
const drawCount = (page: Page) => page.evaluate(() => window.__cameraDraws);

const silhouetteCanvas = (page: Page) => page.locator("#character-canvas-container canvas");
const preview = (page: Page) => page.locator("#character-camera-layer video");

test("shows the preview and runs the silhouette loop against the fake camera", async ({ page }) => {
  await openCameraGame(page);

  await expect(preview(page)).toBeVisible();
  await expect(silhouetteCanvas(page)).toBeVisible();
  await expect.poll(() => streamCount(page)).toBe(1);
  await expect(silhouetteCanvas(page)).toHaveAttribute("width", "640", { timeout: MODEL_TIMEOUT });
  await expect(silhouetteCanvas(page)).toHaveAttribute("height", "480", { timeout: MODEL_TIMEOUT });
  await expect.poll(() => drawCount(page), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(2);
});

test("keeps the silhouette loop running when debug changes the mask type", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await openCameraGame(page);
  await expect.poll(() => drawCount(page), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(2);
  const before = await drawCount(page);

  // Change the debug flag without reloading, as a developer would while the camera runs
  await page.evaluate(() => {
    history.pushState({}, "", "?debug=true");
    dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.locator("#debug-overlay-container")).toBeVisible();
  await expect.poll(() => drawCount(page), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(before);
  await expect(silhouetteCanvas(page)).toBeVisible();
  expect(errors.filter((text) => /tensorflow|disposed/i.test(text))).toEqual([]);
});

test("hides the preview but keeps the camera running when the preview is off", async ({ page }) => {
  await openCameraGame(page, { preview: false });

  await expect(page.locator("#character-camera-layer")).toBeHidden();
  await expect(silhouetteCanvas(page)).toBeVisible();
  await expect.poll(() => drawCount(page), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(2);
  await expect.poll(() => streamCount(page)).toBe(1);
});

test("stops the camera on a camera-off display, and reacquires it on return", async ({ page }) => {
  await openCameraGame(page, { cameraOffStage: "stage-1" });

  await expect(silhouetteCanvas(page)).toBeVisible();
  await expect.poll(() => streamCount(page)).toBe(1);
  expect(await trackState(page, 0)).toBe("live");

  // The title and stage links float, so a plain click never sees them as stable
  await page.locator("#magic-trifle-title").click({ force: true });
  const stageLink = page.locator("#stages-link-stage-1");
  await expect(stageLink).toBeVisible(); // waits for the stepping-stone image, and the link's size
  await stageLink.click({ force: true });

  await expect(page.locator("#character-canvas-container")).toHaveCount(0);
  await expect.poll(() => trackState(page, 0)).toBe("ended");

  await page.getByRole("button", { name: "Close challenge" }).click();

  await expect(silhouetteCanvas(page)).toBeVisible();
  await expect.poll(() => streamCount(page)).toBe(2);
  expect(await trackState(page, 1)).toBe("live");
});

test("switching the fake camera image changes the preview, proving the harness", async ({ page }) => {
  await openCameraGame(page);

  await expect(preview(page)).toBeVisible();
  await expect.poll(() => streamCount(page)).toBe(1);
  // Let the model and the video settle first, so the next captured frame is not held up by either
  await expect.poll(() => drawCount(page), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(2);

  /** A small sample of the preview's current frame, or empty until the video has one. */
  const samplePreview = () =>
    page.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>("#character-camera-layer video");
      if (!video || video.readyState < 2) return "";
      const sample = document.createElement("canvas");
      sample.width = 32;
      sample.height = 24;
      const context = sample.getContext("2d");
      if (!context) return "";
      context.drawImage(video, 0, 0, sample.width, sample.height);
      return sample.toDataURL();
    });

  await expect.poll(samplePreview, { timeout: MODEL_TIMEOUT }).not.toBe("");
  const before = await samplePreview();

  await page.evaluate(() => window.__fakeCamera.setImage("person"));

  await expect.poll(samplePreview, { timeout: MODEL_TIMEOUT }).not.toBe(before);
});

test("plays on by clicks when the camera is busy", async ({ page }) => {
  await openCameraGame(page);
  // Another app holding the camera: the permission is granted, but the device won't start
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Could not start video source", "NotReadableError");
    };
  });
  await page.reload();

  await page.locator("#magic-trifle-title").click({ force: true });
  const stageLink = page.locator("#stages-link-stage-1");
  await expect(stageLink).toBeVisible();
  await expect(page.locator("#character-camera-layer")).toHaveCount(0);
  await stageLink.click({ force: true });

  await expect(page.getByRole("button", { name: "Close challenge" })).toBeVisible();
});
