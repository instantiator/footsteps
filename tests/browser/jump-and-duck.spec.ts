import { expect, test, type Page } from "@playwright/test";
import type { GameRepository } from "../../src/entities/GameRepository";

/** The 2D runner, played by mouse (its fallback) with the camera left off. */
const GAME_ID = "jump-and-duck";

/**
 * Opens the warm-up run without the camera, setting its target score, and waits out the countdown. Motion isn't
 * reduced, as obstacles would then jump straight to the far side. With `feet`, the pointer is the player's feet
 * (`mouse-feet`), and the snowballs hit feet too.
 */
const openWarmUp = async (page: Page, target?: number, { feet = false } = {}) => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const game = repository.games[GAME_ID];
    const [scene] = game.stages[0].challenges[0].scenes;
    if (target !== undefined) scene.component.data.target = target;
    if (feet) {
      game.modules = { ...game.modules, avatar: { mode: "camera", fallback: "mouse-feet", preview: false } };
      for (const { on } of scene.component.rules ?? []) {
        if ("interact" in on && on.target === ".jd-snowball") on.interact = ["foot-enter"];
      }
    }
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

/** Puts the pointer in the snowballs' lane, in the middle of the screen, where it then rests perfectly still. */
const standInSnowballLane = async (page: Page) => {
  const box = (await page.locator("#game-viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.82);
};

/**
 * Plays the warm-up with a target out of reach, standing still in the snowballs' lane once obstacles move: every
 * snowball that passes costs a life, not only each one's first pass, and the run restarts at none.
 */
const loseEveryLife = async (page: Page, options: { feet?: boolean } = {}) => {
  await openWarmUp(page, 100, options);
  await parkClear(page);
  const status = page.locator("#jd-status");
  await expect(status).toContainText("Score 2 of 100 · Lives 3", { timeout: 5_000 });
  const moving = () =>
    page
      .locator(".jd-obstacle")
      .evaluateAll((obstacles) => obstacles.filter((o) => o.getAnimations().length > 0).length);
  await expect.poll(moving, { timeout: 5_000 }).toBeGreaterThan(0);

  await standInSnowballLane(page);
  const lives = async () => (await status.textContent())?.match(/Lives (\d)/)?.[1];
  await expect.poll(lives, { timeout: 15_000 }).toBe("2");
  await expect.poll(lives, { timeout: 30_000 }).toBe("0");
  await expect(page.locator("#jd-message")).toContainText("Ouch");
  await expect(page.locator("#jd-countdown")).toBeVisible({ timeout: 5_000 });
};

test("scores a run as obstacles cross, costs a life for each one a still pointer meets, and restarts at none", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await loseEveryLife(page);
});

test("costs a life for each snowball that meets still mouse-feet", async ({ page }) => {
  test.setTimeout(60_000);
  await loseEveryLife(page, { feet: true });
});

test("spawns obstacles of both kinds, more than the four a fixed pool had, and removes each as it leaves", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openWarmUp(page, 100);
  await parkClear(page);
  const seen = new Map<string, string>();
  const look = async () => {
    const obstacles = await page
      .locator(".jd-obstacle")
      .evaluateAll((elements) => elements.map((element) => [element.id, element.className] as const));
    for (const [id, className] of obstacles) seen.set(id, className);
    return { seen: seen.size, onScreen: obstacles.length, kinds: new Set([...seen.values()]).size };
  };
  await expect.poll(look, { timeout: 30_000 }).toMatchObject({ seen: expect.any(Number), kinds: 2 });
  await expect.poll(async () => (await look()).seen, { timeout: 30_000 }).toBeGreaterThan(4);
  expect((await look()).onScreen).toBeLessThan(seen.size);
});

test("completes a run at its target, opening the next", async ({ page }) => {
  test.setTimeout(60_000);
  await openWarmUp(page, 3);
  await parkClear(page);
  await expect(page.locator("#jd-message")).toHaveText("You made it!", { timeout: 10_000 });
  await expect(page.locator("#stage-link-warm-up")).toHaveClass(/completed/, { timeout: 10_000 });
  await expect(page.locator("#stage-link-long-run")).toBeVisible();
});
