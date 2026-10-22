import { expect, test, type Page } from "@playwright/test";
import type { GameRepository } from "../../src/entities/GameRepository";
import { installCameraDrawCounter } from "./fixtures/cameraDraws";
import { installFakeCamera } from "./fixtures/fakeCamera";

/** How long the TensorFlow model may take to download, start, and draw its first frames. */
const MODEL_TIMEOUT = 120_000;

/** The only game in the repository, patched to switch camera mode on for a test. */
const GAME_ID = "magic-trifle";

/** How the camera behaves on the game's displays. */
interface CameraGameOptions {
  /** Whether the preview shows; defaults to true. */
  preview?: boolean;
  /** A stage whose shared display turns the camera off. */
  cameraOffStage?: string;
}

/** Intercepts the repository and switches camera mode on, with the options the test needs. */
const patchRepository = async (page: Page, options: CameraGameOptions): Promise<void> => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const game = repository.games[GAME_ID];
    game.modules = { ...game.modules, camera: { enabled: true, preview: options.preview ?? true } };

    if (options.cameraOffStage) {
      const stage = game.stages.find(({ id }) => id === options.cameraOffStage);
      const display = stage?.displays?.[0];
      if (!display) throw new Error(`no display on stage ${options.cameraOffStage}`);
      display.camera = { enabled: false };
    }

    await route.fulfill({ response, json: repository });
  });
};

/** Loads the game with a fake camera in place before the page's own scripts run. */
const openCameraGame = async (page: Page, options: CameraGameOptions = {}): Promise<void> => {
  await installFakeCamera(page);
  await installCameraDrawCounter(page);
  await patchRepository(page, options);
  await page.goto(`/game/${GAME_ID}`);
};

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
