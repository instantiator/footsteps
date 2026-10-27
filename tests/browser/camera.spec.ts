import { expect, test, type Page } from "@playwright/test";
import { MODEL_TIMEOUT, openCameraGame } from "./fixtures/cameraGame";
import { peoplePhotoUrls } from "./fixtures/people/people";

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

/** How many of the silhouette canvas's pixels are partly see-through, as feathered edges are. */
const partlyClearPixels = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#character-canvas-container canvas");
    const pixels = canvas?.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
    let count = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0 && pixels[i] < 255) count++;
    return count;
  });

for (const featherPx of [3, 0]) {
  test(`draws the silhouette with ${featherPx ? "feathered" : "hard"} edges when cameraFeatherPx is ${featherPx}`, async ({
    page,
  }) => {
    test.setTimeout(MODEL_TIMEOUT + 30_000);
    await openCameraGame(page, { query: `?cameraFeatherPx=${featherPx}`, photos: peoplePhotoUrls() });
    await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
    await expect.poll(() => drawCount(page), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(2);

    if (featherPx) await expect.poll(() => partlyClearPixels(page), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(100);
    else {
      await page.waitForTimeout(2000); // long enough for the person to be found and drawn
      expect(await partlyClearPixels(page)).toBeLessThan(100); // only scaling's few soft pixels
    }
  });
}
