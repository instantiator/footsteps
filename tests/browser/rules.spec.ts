import { expect, test, type Page } from "@playwright/test";
import type { GameData } from "../../src/entities/data/GameData";
import type { GameRepository } from "../../src/entities/GameRepository";

/** The example game for scene rules. */
const GAME_ID = "rules-demo";

/**
 * Serves the example game with the camera off on every scene (mouse-feet stays), so it plays by mouse without the
 * vision model,
 * after the test's own changes. Motion is reduced so the game's scene changes are immediate: during a fade the
 * scene ignores clicks, and raw mouse clicks (unlike locator clicks) don't wait for it.
 */
const openDemo = async (page: Page, change: (game: GameData) => void = () => {}): Promise<void> => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const game = repository.games[GAME_ID];
    for (const scene of [
      ...game.scenes,
      // The effects stage acts on players, so it can't load without the camera
      ...game.stages
        .filter((stage) => stage.id !== "effects")
        .flatMap((stage) => stage.challenges.flatMap((challenge) => challenge.scenes)),
    ]) {
      if (scene.avatar?.mode !== "mouse-feet") scene.avatar = { mode: "mouse" };
    }
    change(game);
    await route.fulfill({ response, json: repository });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/game/${GAME_ID}/play`);
  await page.locator("#demo-title").click();
  await expect(page.locator("#switch")).toBeVisible();
};

/** The challenge scene of a stage. */
const challengeOf = (game: GameData, stageId: string) =>
  game.stages.find((stage) => stage.id === stageId)!.challenges[0].scenes[0].component;

/** Clicks the middle of an element wherever it is now, as a moving element is never stable enough to wait for. */
/** Moves the mouse to the middle of an element, whatever is drawn over it. */
const moveTo = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
};

const clickNow = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

/** Stands the mouse on the lava's reset scene's start, and waits for the floor to be revealed. */
const returnToStart = async (page: Page) => {
  await expect(page.locator("#reset-message")).toHaveText("Return to the start");
  await page.locator("#reset-start").hover();
  await expect(page.locator("#reset-message")).toHaveText("Get ready!");
  await expect(page.locator("#door-base")).toBeVisible({ timeout: 6000 });
};

/** Opens the balloons stage, and waits out its countdown. */
const startBalloons = async (page: Page) => {
  await page.locator("#stage-link-balloons").click();
  await expect(page.locator("#countdown")).toContainText("Get ready");
  await expect(page.locator("#balloon-0")).toBeVisible({ timeout: 6000 });
};

/** Clicks a balloon once it has fallen into view (each starts above the sky). */
const clickBalloon = async (page: Page, n: number) => {
  const balloon = page.locator(`#balloon-${n}`);
  await expect.poll(async () => (await balloon.boundingBox())?.y ?? -1).toBeGreaterThan(0);
  await clickNow(page, `#balloon-${n} .balloon-body`);
};

test.describe("rules demo", () => {
  test("moves the toggle on each click, keeping its element so the move transitions", async ({ page }) => {
    await openDemo(page);
    const handle = await page.$("#switch");
    const before = (await page.locator("#switch").boundingBox())!;

    await page.locator("#switch").click();

    await expect(page.locator("#switch")).toHaveClass(/position-2/);
    expect(await handle!.evaluate((element) => element.isConnected)).toBe(true);
    // Partway through the transition, the switch is between its two places
    const during = (await page.locator("#switch").boundingBox())!;
    await expect.poll(async () => (await page.locator("#switch").boundingBox())!.x).toBeGreaterThan(during.x);
    expect(during.x).toBeGreaterThanOrEqual(before.x);
  });

  test("keeps a scene's state while it is hidden", async ({ page }) => {
    await openDemo(page);
    await page.locator("#switch").click();
    await expect(page.locator("#switch")).toHaveClass(/position-2/);

    await page.locator("#stage-link-lava").click();
    await expect(page.locator("#reset-message")).toBeVisible();
    await page.getByRole("button", { name: "Close challenge" }).click();

    await expect(page.locator("#switch")).toHaveClass(/position-2/);
  });

  test("plays each item effect on the effects stage with the mouse", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-effects").click();
    await expect(page.locator("#rock")).toBeVisible();

    const animationsOn = (selector: string) =>
      page.locator(selector).evaluate((element) => element.getAnimations().length);

    await page.locator("#lift").click();
    await expect.poll(() => animationsOn("#lift")).toBe(1);

    await page.locator("#lamp").hover();
    await expect.poll(() => animationsOn("#lamp")).toBe(1);
    await page.locator("#effects-message").hover();
    await expect.poll(() => animationsOn("#lamp")).toBe(0);

    await page.locator("#crate").click();
    await expect(page.locator("#effects-message")).toContainText("The crate has fallen");
    await page.locator("#prize").click();
    await page.locator("#bridge").click();
    await expect(page.locator("#effects-message")).toContainText("The bridge has gone");

    await page.locator("#effects-done").click();
    await expect(page.locator("#stage-link-effects")).toHaveClass(/completed/);
  });

  test("rebuilds a scene's template when it resets, restarting its animations", async ({ page }) => {
    await openDemo(page, (game) => {
      challengeOf(game, "balloons").rules!.push({
        on: { interact: ["click"], target: "#score" },
        do: [{ resetState: true }],
      });
    });
    await startBalloons(page);
    const balloon = page.locator(".balloon");
    await balloon.evaluate((element) => element.setAttribute("data-before-reset", "yes"));
    const runningFor = () =>
      balloon.evaluate((element) => Number(element.getAnimations({ subtree: true })[0]?.currentTime ?? 0));
    await expect.poll(runningFor).toBeGreaterThan(300);

    await page.locator("#score").click();

    await expect(page.locator(".balloon[data-before-reset]")).toHaveCount(0);
    expect(await runningFor()).toBeLessThan(300);
  });

  test("pops balloons where they are, scores them, replaces missed ones, and completes at the target", async ({
    page,
  }) => {
    await openDemo(page, (game) => {
      challengeOf(game, "balloons").data = { target: 2 };
      challengeOf(game, "balloons").initialState = {
        score: 0,
        balloonIndex: 0,
        popping: false,
        dropMs: 2500,
        left: 45,
        colour: 0,
      };
    });
    await startBalloons(page);

    // A balloon that isn't popped falls to the bottom, pops, and is replaced
    await expect(page.locator("#balloon-1")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#score")).toHaveText("0 / 2");

    // Popping freezes the balloon where it is, rather than sending it back to the top
    await page.waitForTimeout(800);
    const falling = (await page.locator("#balloon-1").boundingBox())!;
    await clickNow(page, "#balloon-1 .balloon-body");
    await expect(page.locator("#balloon-1")).toHaveClass(/popping/);
    // It fades out from the balloons' opacity as it pops, and the next balloon is back at that opacity
    const opacity = (n: number) =>
      page.locator(`#balloon-${n} .balloon-body`).evaluate((element) => Number(getComputedStyle(element).opacity));
    await expect.poll(() => opacity(1).catch(() => 0)).toBeLessThan(0.8);
    const popped = (await page.locator("#balloon-1").boundingBox())!;
    await page.waitForTimeout(100);
    const later = page.locator("#balloon-1");
    if (await later.count()) expect((await later.boundingBox())?.y).toBe(popped.y);
    expect(Math.abs(popped.y - falling.y)).toBeLessThan(40);
    await expect(page.locator("#score")).toHaveText("1 / 2");

    await expect(page.locator("#balloon-2")).toBeVisible();
    expect(await opacity(2)).toBeCloseTo(0.8);

    // Reaching the target completes the challenge, and the game goes back to the stages
    await clickBalloon(page, 2);
    await expect(page.locator("#stage-link-balloons")).toHaveClass(/completed/);
  });

  test("starts the balloons afresh each time the stage opens", async ({ page }) => {
    await openDemo(page, (game) => {
      challengeOf(game, "balloons").data = { target: 5 };
    });
    await startBalloons(page);
    await clickBalloon(page, 0);
    await expect(page.locator("#score")).toHaveText("1 / 5");

    await page.getByRole("button", { name: "Close challenge" }).click();
    await startBalloons(page);

    await expect(page.locator("#score")).toHaveText("0 / 5");
  });

  test("asks for the start before the lava, sends the mouse back there from lava, and completes at the door", async ({
    page,
  }) => {
    await openDemo(page);
    await page.locator("#stage-link-lava").click();
    await returnToStart(page);

    await page.locator("#lava-1").hover();
    await returnToStart(page);

    await page.locator("#door-base").hover();
    await expect(page.locator("#stage-link-lava")).toHaveClass(/completed/);
  });

  test("jumps the lava in mouse-feet by dragging from the start onto the door", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-stepping-stones").click();
    await expect(page.locator("#lava-message")).toContainText("Drag from the start to the door");

    await moveTo(page, "#start");
    await page.mouse.down();
    await moveTo(page, "#door-base");
    await page.mouse.up();

    await expect(page.locator("#stage-link-stepping-stones")).toHaveClass(/completed/);
  });

  test("asks for the start again when the game is reloaded", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-lava").click();
    await returnToStart(page);

    await page.reload();

    await expect(page.locator("#reset-message")).toHaveText("Return to the start");
  });

  test("lights the bulb while the mouse is over it", async ({ page }) => {
    await openDemo(page);
    await page.locator("#bulb").hover();
    await expect(page.locator("#bulb")).toHaveClass(/lit/);

    await page.locator("#switch").hover();
    await expect(page.locator("#bulb")).not.toHaveClass(/lit/);
  });

  test("lets the mouse through empty foreground to the background, but not through something drawn over it", async ({
    page,
  }) => {
    await openDemo(page, (game) => {
      // A cover over the first lava pool, in the foreground; the rest of the foreground is empty
      challengeOf(game, "lava").foregroundTemplate = {
        sourceType: "embedded",
        content:
          '<div class="demo-screen" style="pointer-events: none">' +
          '<div id="cover" style="position: absolute; left: 15%; top: 50%; width: 30%; height: 22%; background: #0008; pointer-events: auto"></div>' +
          "</div>",
      };
      challengeOf(game, "lava").foregroundTemplateStyle = { width: "100%", height: "100%" };
    });
    await page.locator("#stage-link-lava").click();
    await returnToStart(page);
    await expect(page.locator("#cover")).toBeVisible();

    await moveTo(page, "#lava-1");
    await expect(page.locator("#door-base")).toBeVisible();

    await moveTo(page, "#lava-2");
    await expect(page.locator("#reset-message")).toBeVisible();
  });
});
