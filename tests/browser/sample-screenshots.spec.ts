import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Renders each sample element in the scene renderer, and saves what it looks like for the docs. It only runs with
 * `CAPTURE_SAMPLES=1`, so the normal suite never rewrites the pictures. Re-run it when a surface's drawing changes.
 */
const SAMPLES = "docs/tutorials/samples";
const IMAGES = "docs/tutorials/images";

/** The samples to capture, and the extra screen shapes some are shown at. */
const shots = readdirSync(SAMPLES)
  .filter((name) => name.endsWith(".html"))
  .flatMap((name) => {
    const sample = name.replace(/\.html$/, "");
    const normal = { sample, file: sample, width: 1280, height: 720 };
    return sample === "wide-sky" ? [normal, { sample, file: `${sample}-wide`, width: 2400, height: 720 }] : [normal];
  });

test.skip(process.env.CAPTURE_SAMPLES !== "1", "set CAPTURE_SAMPLES=1 to capture the sample pictures");

for (const { sample, file, width, height } of shots) {
  test(`captures ${file}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/scene-renderer");
    await page.getByLabel("Scene HTML").fill(readFileSync(`${SAMPLES}/${sample}.html`, "utf8"));
    await expect(page.locator("#scene-messages li")).toHaveCount(0);
    // Wait out the rebuild delay, then a few frames for placement
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: ".hudStyle { visibility: hidden; }" });
    await page.locator("#scene-pane").screenshot({ path: `${IMAGES}/${file}.png` });
  });
}
