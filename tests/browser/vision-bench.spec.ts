import { expect, test } from "@playwright/test";
import { MODEL_TIMEOUT, openCameraGame } from "./fixtures/cameraGame";

/** How long to sample the vision loop for, once it is running. */
const SAMPLE_MS = 10_000;

/** The median of a non-empty list. */
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

// Only runs when asked, as it measures rather than checks: VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench
test.skip(!process.env.VISION_BENCH, "set VISION_BENCH=1 to run the vision benchmark");

test("measures the vision loop's frame rate and inference time", async ({ page }) => {
  await openCameraGame(page, {}, `?debug=true${process.env.VISION_BENCH_QUERY ?? ""}`);
  await page.evaluate(() => window.__fakeCamera.setImage("person"));
  const readout = page.locator("output.vision-stats");
  await expect(readout).toBeVisible({ timeout: MODEL_TIMEOUT });

  const fps: number[] = [];
  const inferenceMs: number[] = [];
  for (let elapsed = 0; elapsed < SAMPLE_MS; elapsed += 1000) {
    await page.waitForTimeout(1000);
    fps.push(Number(await readout.getAttribute("data-fps")));
    inferenceMs.push(Number(await readout.getAttribute("data-inference-ms")));
  }

  const result = { fps: median(fps), inferenceMs: median(inferenceMs), query: process.env.VISION_BENCH_QUERY ?? "" };
  console.log(`vision-bench ${JSON.stringify(result)}`);
  test.info().annotations.push({ type: "vision-bench", description: JSON.stringify(result) });
  expect(result.fps).toBeGreaterThan(0);
});
