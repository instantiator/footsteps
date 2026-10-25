import { expect, test, type Locator, type Page } from "@playwright/test";
import { MODEL_TIMEOUT, openCameraGame } from "./fixtures/cameraGame";
import type { FakeCameraImage } from "./fixtures/fakeCamera";
import { PEOPLE_PHOTOS, peoplePhotoUrls } from "./fixtures/people/people";

/** How long a scene is shown before sampling, so the model and smoothing settle. */
const SETTLE_MS = 2000;

/** How many one-second samples to take of each scene. */
const SAMPLES = 5;

/** The readout's numbers, sampled. */
const MEASURES = ["fps", "inference-ms", "people", "hands", "feet", "coverage", "reach"] as const;

/**
 * Lets models find everyone in the group photos (up to ten); the game's own default may be lower.
 * A query in `VISION_BENCH_QUERY` comes after this, so it can set a different number.
 */
const BENCH_QUERY = "&visionMaxPeople=10";

/** The median of a non-empty list. */
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** The readout's medians over {@link SAMPLES} seconds. */
const sample = async (page: Page, readout: Locator): Promise<Record<(typeof MEASURES)[number], number>> => {
  const readings = MEASURES.map(() => [] as number[]);
  for (let i = 0; i < SAMPLES; i++) {
    await page.waitForTimeout(1000);
    for (const [index, measure] of MEASURES.entries()) {
      readings[index].push(Number(await readout.getAttribute(`data-${measure}`)));
    }
  }
  return Object.fromEntries(MEASURES.map((measure, index) => [measure, median(readings[index])])) as Record<
    (typeof MEASURES)[number],
    number
  >;
};

// Only runs when asked, as it measures rather than checks: VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench
// VISION_BENCH_QUERY adds config (eg. "&visionModel=mediapipe"); VISION_BENCH_SHOTS saves each scene's debug view
// to that folder, named VISION_BENCH_LABEL-<scene>.png; VISION_BENCH_CAMERA sets the fake camera's size, eg. 640x480
// (by default 1280x720, the resolution the game asks a real camera for)
test.skip(!process.env.VISION_BENCH, "set VISION_BENCH=1 to run the vision benchmark");

test("measures the vision loop on an empty room and on photos of people", async ({ page }) => {
  const scenes = [{ name: "empty-room", people: 0, fullLength: true }, ...PEOPLE_PHOTOS];
  test.setTimeout(MODEL_TIMEOUT + scenes.length * (SETTLE_MS + SAMPLES * 1000 + 5000));
  const query = process.env.VISION_BENCH_QUERY ?? "";
  await page.setViewportSize({ width: 1280, height: 800 });
  const [width, height] = (process.env.VISION_BENCH_CAMERA ?? "1280x720").split("x").map(Number);
  await openCameraGame(page, {
    query: `?debug=true${BENCH_QUERY}${query}`,
    photos: peoplePhotoUrls(),
    cameraSize: { width, height },
  });
  const readout = page.locator("output.vision-stats");
  await expect(readout).toBeVisible({ timeout: MODEL_TIMEOUT });

  const results = [];
  for (const scene of scenes) {
    const image: FakeCameraImage = scene.name === "empty-room" ? "room" : `photo:${scene.name}`;
    await page.evaluate((next) => window.__fakeCamera.setImage(next), image);
    await page.waitForTimeout(SETTLE_MS);
    const measured = await sample(page, readout);
    const shots = process.env.VISION_BENCH_SHOTS;
    if (shots) {
      const label = process.env.VISION_BENCH_LABEL ?? "bench";
      await page
        .locator("#character-canvas-container canvas")
        .screenshot({ path: `${shots}/${label}-${scene.name}.png` });
    }
    // Hands are expected whatever the framing; feet only when the people are in shot to their feet
    const expected = {
      people: scene.people,
      hands: 2 * scene.people,
      feet: scene.fullLength ? 2 * scene.people : null,
    };
    results.push({ scene: scene.name, expected, ...measured });
  }

  for (const result of results) console.log(`vision-bench ${JSON.stringify({ query, ...result })}`);
  test.info().annotations.push({ type: "vision-bench", description: JSON.stringify({ query, results }) });
  expect(results.every(({ fps }) => fps > 0)).toBe(true);
});
