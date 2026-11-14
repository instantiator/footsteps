import { expect, test, type Page } from "@playwright/test";
import type { GameRepository } from "../../src/entities/GameRepository";

/** The 2D runner, played by mouse (its fallback) with the camera left off. */
const GAME_ID = "jump-and-duck";

/**
 * Opens the warm-up run without the camera, setting its target score, and waits out the countdown. Motion isn't
 * reduced, as obstacles would then jump straight to the far side.
 */
const openWarmUp = async (page: Page, target?: number) => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const [scene] = repository.games[GAME_ID].stages[0].challenges[0].scenes;
    if (target !== undefined) scene.component.data.target = target;
    await route.fulfill({ response, json: repository });
  });
  await page.goto(`/game/${GAME_ID}/play?noCamera=true`);
  await page.locator("#jd-title").click();
  await page.locator("#stage-link-warm-up").click();
  await expect(page.locator("#jd-countdown")).toBeVisible();
  await expect(page.locator("#jd-status")).toBeVisible({ timeout: 10_000 });
};

/** Parks the pointer in the top left corner, clear of both lanes. */
const parkClear = async (page: Page) => {
  const box = (await page.locator("#game-viewport").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
};

/**
 * Holds the pointer in the snowballs' lane, in the middle of the screen, nudging it a pixel each time as a player's
 * hand would: the browser may not report an element moving under a perfectly still pointer.
 */
const standInSnowballLane = async (page: Page, nudge = 0) => {
  const box = (await page.locator("#game-viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + (nudge % 2), box.y + box.height * 0.82);
};

test("scores a run as obstacles cross, costs a life for each one the pointer meets, and restarts at none", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openWarmUp(page, 100); // a target out of reach, so the run ends by losing
  await parkClear(page);
  const status = page.locator("#jd-status");
  await expect(status).toContainText("Score 2 of 100 · Lives 3", { timeout: 5_000 });
  const moving = () =>
    page
      .locator(".jd-obstacle")
      .evaluateAll((obstacles) => obstacles.filter((o) => o.getAnimations().length > 0).length);
  await expect.poll(moving, { timeout: 5_000 }).toBeGreaterThan(0);

  let nudges = 0;
  const livesAfterNudge = async () => {
    await standInSnowballLane(page, nudges++);
    return (await status.textContent())?.match(/Lives (\d)/)?.[1];
  };
  await expect.poll(livesAfterNudge, { timeout: 15_000 }).toBe("2");
  await expect.poll(livesAfterNudge, { timeout: 30_000 }).toBe("0");
  await expect(page.locator("#jd-message")).toContainText("Ouch");
  await expect(page.locator("#jd-countdown")).toBeVisible({ timeout: 5_000 });
});

test("completes a run at its target, opening the next", async ({ page }) => {
  test.setTimeout(60_000);
  await openWarmUp(page, 3);
  await parkClear(page);
  await expect(page.locator("#jd-message")).toHaveText("You made it!", { timeout: 10_000 });
  await expect(page.locator("#stage-link-warm-up")).toHaveClass(/completed/, { timeout: 10_000 });
  await expect(page.locator("#stage-link-long-run")).toBeVisible();
});
