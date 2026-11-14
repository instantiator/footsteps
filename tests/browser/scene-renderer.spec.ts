import { expect, test } from "@playwright/test";

/** The scene renderer: pasted HTML plays as a 2.5D scene, with the validator's messages beside it. */
test("renders the starter scene's floor item on the floor, and lists problems in pasted HTML", async ({ page }) => {
  await page.goto("/scene-renderer");
  const tree = page.locator("#scene-pane #tree");
  await expect(tree).toBeVisible();
  await expect(page.locator("#scene-pane .floorScene")).toBeVisible();
  // Placed halfway back, the tree is drawn smaller than its layout size
  await expect
    .poll(() => tree.evaluate((element: HTMLElement) => element.getBoundingClientRect().width / element.offsetWidth))
    .toBeLessThan(0.95);
  if (process.env.SCENE_RENDERER_SHOT) await page.screenshot({ path: process.env.SCENE_RENDERER_SHOT });

  await page.getByLabel("Scene HTML").fill('<div id="stone" data-depth="2">A stone</div>');
  await expect(page.locator("#scene-pane #stone")).toHaveText("A stone");
  await expect(page.locator("#scene-messages .problem")).toContainText("data-depth is no longer supported");

  await page.getByLabel("Scene HTML").fill('<div class="left-wall" data-fill-width></div>');
  await expect(page.locator("#scene-messages .warning")).toContainText("data-fill-width does nothing here");
});
