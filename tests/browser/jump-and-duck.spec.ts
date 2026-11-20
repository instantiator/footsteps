import { expect, test, type Page } from "@playwright/test";
import type { GameRepository } from "../../src/entities/GameRepository";

/** The 2D runner, one of the demo game's stages, played by mouse (its fallback) with the camera left off. */
const GAME_ID = "rules-demo";

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
    const [scene] = game.stages.find((stage) => stage.id === "warm-up")!.challenges[0].scenes;
    if (target !== undefined) scene.component.data.target = target;
    if (feet) {
      scene.avatar = { mode: "camera", fallback: "mouse-feet", preview: false };
      for (const { on } of scene.component.rules ?? []) {
        if ("interact" in on && on.target === ".jd-snowball") on.interact = ["foot-enter"];
      }
    }
    await route.fulfill({ response, json: repository });
  });
  await page.goto(`/game/${GAME_ID}/play?noCamera=true`);
  await page.locator("#demo-title").click();
  await page.locator("#stage-link-warm-up").click();
  await startRun(page);
};

/** Stands on the shared reset's Start, and waits out its countdown until the run is under way. */
const startRun = async (page: Page) => {
  await expect(page.locator("#reset-message")).toBeVisible();
  await page.locator("#reset-start").hover({ force: true });
  await expect(page.locator("#reset-count")).toBeVisible();
  await expect(page.locator("#jd-status")).toBeVisible({ timeout: 10_000 });
};

/** Each lane's height, as a share of the screen: the middle of its obstacles. */
const LANES = { snowball: 0.82, bat: 0.22 } as const;

/** Where the pointer goes in a lane: the middle of the screen, nudged right by `nudge` pixels. */
const laneSpot = async (page: Page, lane: keyof typeof LANES, nudge = 0) => {
  const box = (await page.locator("#game-viewport").boundingBox())!;
  return { x: box.x + box.width / 2 + nudge, y: box.y + box.height * LANES[lane] };
};

/**
 * Plays the warm-up with the pointer in one lane from before the run starts, still or moving, and checks the first
 * obstacle in that lane has cost exactly one life once it has popped or passed the pointer. A re-render can detach an
 * obstacle for a moment, so it only counts as popped once it has stayed gone.
 */
const firstInLaneCostsALife = async (page: Page, lane: keyof typeof LANES, moving: boolean) => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const [scene] = repository.games[GAME_ID].stages.find((stage) => stage.id === "warm-up")!.challenges[0].scenes;
    scene.component.data.target = 100;
    await route.fulfill({ response, json: repository });
  });
  await page.goto(`/game/${GAME_ID}/play?noCamera=true`);
  await page.locator("#demo-title").click();
  await page.locator("#stage-link-warm-up").click();
  await startRun(page);
  const spot = await laneSpot(page, lane);
  await page.mouse.move(spot.x, spot.y);

  const first = page.locator(`.jd-${lane}`).first();
  await expect(first).toBeAttached({ timeout: 20_000 });
  const id = (await first.getAttribute("id"))!;
  // Read without waiting, as a popped obstacle never comes back
  const rightEdge = () => page.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().right ?? null, id);
  let nudge = 0;
  let detachedFor = 0;
  for (;;) {
    const right = await rightEdge();
    if (right !== null && right < spot.x - 30) break;
    // A hit pops the obstacle; a re-render detaches it only for a moment
    detachedFor = right === null ? detachedFor + 1 : 0;
    if (detachedFor > 10) break;
    if (moving) {
      nudge = nudge === 0 ? 20 : 0;
      const { x, y } = await laneSpot(page, lane, nudge);
      await page.mouse.move(x, y);
    }
    await page.waitForTimeout(50);
  }
  await expect(page.locator("#jd-status")).toContainText("Lives 2");
};

for (const lane of ["snowball", "bat"] as const) {
  for (const moving of [false, true]) {
    test(`costs a life for the first ${lane} under a pointer ${moving ? "moving in" : "parked in"} its lane before the run starts`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await firstInLaneCostsALife(page, lane, moving);
    });
  }
}

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
  await expect(page.locator("#reset-message")).toBeVisible({ timeout: 5_000 });
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
