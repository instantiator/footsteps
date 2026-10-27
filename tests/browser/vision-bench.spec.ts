import { expect, test, type Locator, type Page } from "@playwright/test";
import type { GameRepository } from "../../src/entities/GameRepository";
import { MODEL_TIMEOUT, openCameraGame } from "./fixtures/cameraGame";
import { installFakeCamera, type FakeCameraImage } from "./fixtures/fakeCamera";
import { PEOPLE_PHOTOS, peoplePhotoUrls } from "./fixtures/people/people";
import { installReactCommitCounter } from "./fixtures/reactCommits";

/** How long a scene is shown before sampling, so the model and smoothing settle. */
const SETTLE_MS = 2000;

/** How many one-second samples to take of each scene. */
const SAMPLES = 5;

/** The readout's numbers, sampled. */
const MEASURES = [
  "fps",
  "inference-ms",
  "track-ms",
  "monitor-ms",
  "draw-ms",
  "people",
  "hands",
  "feet",
  "coverage",
  "reach",
] as const;

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
// VISION_BENCH_PLAIN=1 measures the game as played (plain silhouettes, readout from showFps) rather than in debug
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
    query: `?${process.env.VISION_BENCH_PLAIN ? "showFps=true" : "debug=true"}${BENCH_QUERY}${query}`,
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

/** How long the game is measured while it plays, in milliseconds. */
const PLAY_MS = 10_000;

/** Serves the rules demo with the camera on and no preview, as it would be played in front of a camera. */
const openRulesDemoWithCamera = async (page: Page, query: string): Promise<void> => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    repository.games["rules-demo"].modules = { camera: { enabled: true, preview: false } };
    await route.fulfill({ response, json: repository });
  });
  await page.goto(`/game/rules-demo/play${query}`);
};

test("measures the vision loop while the balloons challenge plays", async ({ page }) => {
  test.setTimeout(MODEL_TIMEOUT + SETTLE_MS + PLAY_MS + 30_000);
  const query = process.env.VISION_BENCH_QUERY ?? "";
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.context().grantPermissions(["camera"]);
  await installFakeCamera(page, peoplePhotoUrls(), { width: 1280, height: 720 });
  await installReactCommitCounter(page);
  await openRulesDemoWithCamera(page, `?showFps=true${query}`);
  await page.locator("#demo-title").click();
  await page.locator("#stage-link-balloons").click();
  await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
  const readout = page.locator("output.vision-stats");
  await expect(readout).toBeVisible({ timeout: MODEL_TIMEOUT });
  await page.waitForTimeout(SETTLE_MS);

  const commitsBefore = await page.evaluate(() => window.__reactCommits);
  const measured = await sample(page, readout);
  await page.waitForTimeout(PLAY_MS - SAMPLES * 1000);
  const commits = (await page.evaluate(() => window.__reactCommits)) - commitsBefore;
  const result = { query, ...measured, reactCommitsPerSecond: commits / (PLAY_MS / 1000) };

  console.log(`vision-bench-play ${JSON.stringify(result)}`);
  test.info().annotations.push({ type: "vision-bench-play", description: JSON.stringify(result) });
  expect(result.fps).toBeGreaterThan(0);
});
