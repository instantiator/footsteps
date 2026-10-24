import { expect, test, type Locator } from "@playwright/test";
import { MODEL_TIMEOUT, openCameraGame } from "./fixtures/cameraGame";
import type { FakeCameraImage } from "./fixtures/fakeCamera";
import { PEOPLE_PHOTOS, peoplePhotoUrls } from "./fixtures/people/people";

/** How long a scene is shown before sampling, so the model and smoothing settle. */
const SETTLE_MS = 2000;

/** How many one-second samples to take of each scene. */
const SAMPLES = 5;

/** The median of a non-empty list. */
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** The readout's medians over {@link SAMPLES} seconds. */
const sample = async (page: { waitForTimeout: (ms: number) => Promise<void> }, readout: Locator) => {
  const readings = { fps: [] as number[], inferenceMs: [] as number[], people: [] as number[] };
  for (let i = 0; i < SAMPLES; i++) {
    await page.waitForTimeout(1000);
    readings.fps.push(Number(await readout.getAttribute("data-fps")));
    readings.inferenceMs.push(Number(await readout.getAttribute("data-inference-ms")));
    readings.people.push(Number(await readout.getAttribute("data-people")));
  }
  return { fps: median(readings.fps), inferenceMs: median(readings.inferenceMs), people: median(readings.people) };
};

// Only runs when asked, as it measures rather than checks: VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench
test.skip(!process.env.VISION_BENCH, "set VISION_BENCH=1 to run the vision benchmark");

test("measures the vision loop on an empty room and on photos of people", async ({ page }) => {
  test.setTimeout(MODEL_TIMEOUT + (PEOPLE_PHOTOS.length + 1) * (SETTLE_MS + SAMPLES * 1000 + 5000));
  const query = process.env.VISION_BENCH_QUERY ?? "";
  await openCameraGame(page, {}, `?debug=true${query}`, peoplePhotoUrls());
  const readout = page.locator("output.vision-stats");
  await expect(readout).toBeVisible({ timeout: MODEL_TIMEOUT });

  const results = [];
  for (const scene of [{ name: "empty-room", people: 0 }, ...PEOPLE_PHOTOS]) {
    const image: FakeCameraImage = scene.name === "empty-room" ? "room" : `photo:${scene.name}`;
    await page.evaluate((next) => window.__fakeCamera.setImage(next), image);
    await page.waitForTimeout(SETTLE_MS);
    results.push({ scene: scene.name, expected: scene.people, ...(await sample(page, readout)) });
  }

  for (const result of results) console.log(`vision-bench ${JSON.stringify({ query, ...result })}`);
  test.info().annotations.push({ type: "vision-bench", description: JSON.stringify({ query, results }) });
  expect(results.every(({ fps }) => fps > 0)).toBe(true);
});
