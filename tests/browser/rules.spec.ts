import { expect, test, type Page } from "@playwright/test";
import type { GameData } from "../../src/entities/data/GameData";
import type { GameRepository } from "../../src/entities/GameRepository";

/** The example game for scene rules. */
const GAME_ID = "rules-demo";

/**
 * Serves the example game, after the test's own changes, and plays it without the camera (`noCamera`), so each scene
 * plays in its fallback mode, without the vision model. Motion is reduced so the game's scene changes are immediate:
 * during a fade the scene ignores clicks, and raw mouse clicks (unlike locator clicks) don't wait for it.
 */
const openDemo = async (page: Page, change: (game: GameData) => void = () => {}): Promise<void> => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    change(repository.games[GAME_ID]);
    await route.fulfill({ response, json: repository });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/game/${GAME_ID}/play?noCamera=true`);
  await page.locator("#demo-title").click();
  await expect(page.locator("#switch")).toBeVisible();
};

/** The challenge scene of a stage. */
const challengeOf = (game: GameData, stageId: string) =>
  game.stages.find((stage) => stage.id === stageId)!.challenges[0].scenes[0].component;

/** Clicks the middle of an element wherever it is now, as a moving element is never stable enough to wait for. */
/** The middle of an element, on the page. */
const centreOf = async (page: Page, selector: string): Promise<[number, number]> => {
  const box = (await page.locator(selector).boundingBox())!;
  return [box.x + box.width / 2, box.y + box.height / 2];
};

/** Moves the mouse to the middle of an element, whatever is drawn over it. */
const moveTo = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
};

const clickNow = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

/** Stands the mouse on the pits' reset scene's start, and waits for the floor to be revealed. */
const returnToStart = async (page: Page) => {
  await expect(page.locator("#reset-message")).toHaveText("Stand on Start, or put your mouse on it");
  await page.locator("#reset-start").hover();
  await expect(page.locator("#reset-message")).toHaveText("Get ready!");
  await expect(page.locator("#door-base")).toBeVisible({ timeout: 6000 });
};

/** Puts the mouse on the shared reset's Start, and waits out its countdown for the bridge. */
const crossingStart = async (page: Page) => {
  await page.locator("#stage-link-bridge-across-lava").click();
  await expect(page.locator("#reset-message")).toHaveText("Stand on Start, or put your mouse on it");
  await page.locator("#reset-start").hover();
  await expect(page.locator("#bridge-1")).toBeVisible({ timeout: 6000 });
};

/** Moves the mouse onto lava: the floor, in its front right corner, clear of the bridge. */
const moveOntoLava = async (page: Page) => {
  const viewport = (await page.locator(".floorScene .sceneBox").first().boundingBox())!;
  const inset = viewport.width * 0.06;
  await page.mouse.move(viewport.x + viewport.width - inset, viewport.y + viewport.height - inset);
};

/** Walks the mouse onto a section of the bridge, and waits for the section behind it to fall away. */
const walkOnto = async (page: Page, n: number) => {
  // Section 4 only turns solid once it has appeared, so a foot put there sooner would be on lava
  if (n === 4) await expect(page.locator("#bridge-4")).not.toHaveClass(/unseen|appearing/, { timeout: 4000 });
  await moveTo(page, `#bridge-${n}`);
  if (n > 1) await expect(page.locator(`#bridge-${n - 1}`)).toHaveClass(/gone/, { timeout: 4000 });
};

/** Opens the balloons stage, and waits out its countdown. */
const startBalloons = async (page: Page) => {
  await page.locator("#stage-link-balloons").click();
  await expect(page.locator("#reset-message")).toBeVisible();
  await page.locator("#reset-start").hover();
  await expect(page.locator("#reset-count")).toBeVisible();
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

  test("stands on Start, counts 3-2-1, then starts the stage", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-balloons").click();
    await expect(page.locator("#reset-message")).toHaveText("Stand on Start, or put your mouse on it");

    await page.locator("#reset-start").hover();

    await expect(page.locator("#reset-message")).toHaveText("Get ready!");
    await expect(page.locator("#reset-count")).toHaveText("3");
    await expect(page.locator("#reset-count")).toHaveText("2");
    await expect(page.locator("#reset-count")).toHaveText("1");
    await expect(page.locator("#balloon-0")).toBeVisible({ timeout: 6000 });
    await expect(page.locator("#reset-message")).toHaveCount(0);
  });

  test("a pointer off Start leaves the reset showing", async ({ page }) => {
    await openDemo(page);
    // Opened without the mouse, which would otherwise rest wherever the stage's link is, perhaps on Start
    await page.locator("#stage-link-balloons").dispatchEvent("click");
    await expect(page.locator("#reset-message")).toBeVisible();

    await page.mouse.move(5, 5);
    await page.waitForTimeout(1500);

    await expect(page.locator("#reset-message")).toHaveText("Stand on Start, or put your mouse on it");
    await expect(page.locator("#reset-count")).toHaveCount(0);
  });

  test("keeps a scene's state while it is hidden", async ({ page }) => {
    await openDemo(page);
    await page.locator("#switch").click();
    await expect(page.locator("#switch")).toHaveClass(/position-2/);

    await page.locator("#stage-link-pits").click();
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

  test("asks for the start before the pits, drops the mouse into a pit and back there, and completes at the door", async ({
    page,
  }) => {
    await openDemo(page);
    await page.locator("#stage-link-pits").click();
    await returnToStart(page);

    await page.locator("#pit-1").hover();
    await returnToStart(page);

    await page.locator("#door-base").hover();
    await expect(page.locator("#stage-link-pits")).toHaveClass(/completed/);
  });

  test("walks the clear path to the door without falling", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-pits").click();
    await returnToStart(page);

    const centre = async (selector: string) => {
      const box = (await page.locator(selector).boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const [start, one, two, three, door] = await Promise.all(
      ["#start", "#pit-1", "#pit-2", "#pit-3", "#door-base"].map(centre),
    );
    // Up the channel between the first two pits, then across the gap in front of the third, then to the door
    const channelX = (one.x + two.x) / 2;
    const gapY = (two.y + three.y) / 2;
    const gapX = (two.x + three.x) / 2;
    const path = [{ x: channelX, y: start.y }, { x: channelX, y: gapY }, { x: gapX, y: gapY }, door];

    await page.mouse.move(start.x, start.y);
    for (const point of path) await page.mouse.move(point.x, point.y, { steps: 25 });

    await expect(page.locator("#stage-link-pits")).toHaveClass(/completed/);
    await expect(page.locator("#reset-message")).toHaveCount(0);
  });

  test("lets the mouse pass through the warning signs", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-pits").click();
    await returnToStart(page);

    await expect(page.locator(".pit-sign")).toHaveCount(3);
    for (const sign of await page.locator(".pit-sign-board").all()) {
      const box = (await sign.boundingBox())!;
      const caught = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".pit-sign") !== null, {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      });
      expect(caught).toBe(false);
    }
  });

  test("finishes the reset for mouse-feet already resting where the start appears, without them moving", async ({
    page,
  }) => {
    // A jump on the spot on the first section resets the challenge, leaving the feet where the reset scene's start appears
    await openDemo(page, (game) =>
      challengeOf(game, "bridge-across-lava").rules!.push({
        on: { interact: "jump", target: "#bridge-1" },
        do: [{ resetChallenge: true }],
      }),
    );
    await crossingStart(page);
    const run = () =>
      page.locator("[data-scene-scope^='challenge:'] .templateBody").first().getAttribute("data-scene-run");
    const before = await run();

    const section = (await page.locator("#bridge-1").boundingBox())!;
    await page.mouse.move(section.x + section.width / 2, section.y + section.height / 2);
    await page.mouse.down();
    await page.mouse.move(section.x + section.width / 2 + 15, section.y + section.height / 2, { steps: 3 });
    await page.mouse.up();

    await expect.poll(run).not.toBe(before);
    await expect(page.locator("#reset-message")).toHaveCount(0);
    await expect(page.locator("#bridge-1")).toBeVisible();
  });

  test("takes a pit laid on the floor only where it is drawn, not anywhere in its box", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-pits").click();
    await returnToStart(page);

    // The pit narrows to the back, so its box's top left corner is off the pit
    const pool = (await page.locator("#pit-1").boundingBox())!;
    await page.mouse.move(pool.x + 3, pool.y + 3);
    await page.waitForTimeout(500);
    await expect(page.locator("#reset-message")).toHaveCount(0);

    await moveTo(page, "#pit-1");
    await expect(page.locator("#reset-message")).toBeVisible();
  });

  test("walks the bridge by mouse-feet, each section falling behind, and the door completes from the last", async ({
    page,
  }) => {
    await openDemo(page);
    await crossingStart(page);

    for (const n of [2, 3, 4, 5]) await walkOnto(page, n);
    await expect(page.locator("#bridge-5")).toBeVisible();

    await moveTo(page, "#door");
    await expect(page.locator("#stage-link-bridge-across-lava")).toHaveClass(/completed/, { timeout: 4000 });
  });

  test("walking from the last section onto the door shows no warning", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);
    for (const n of [2, 3, 4, 5]) await walkOnto(page, n);
    // Any appearance of the warning, however brief
    await page.evaluate(() => {
      const seen = { warned: false };
      Object.assign(window, { seen });
      new MutationObserver(() => {
        if (document.querySelector(".bridge-glow")) seen.warned = true;
      }).observe(document.body, { subtree: true, childList: true });
    });

    // Down the door's base, in steps, as a foot approaching it would
    const door = (await page.locator("#door").boundingBox())!;
    await page.mouse.move(door.x + door.width / 2, door.y + door.height - 3, { steps: 15 });

    await expect(page.locator("#stage-link-bridge-across-lava")).toHaveClass(/completed/, { timeout: 4000 });
    expect(await page.evaluate(() => Reflect.get(window, "seen").warned)).toBe(false);
  });

  test("shows the warning for a foot on lava, and clears it on return to the bridge", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);

    await moveOntoLava(page);
    await expect(page.locator(".bridge-glow")).toBeVisible();
    await expect(page.locator("#bridge-message")).toContainText("Get off the lava");

    await moveTo(page, "#bridge-1");
    await expect(page.locator(".bridge-glow")).toHaveCount(0);
    await page.waitForTimeout(2500); // past the 2 s it would have taken to fall
    await expect(page.locator("#reset-message")).toHaveCount(0);
  });

  test("falls and resets for a foot left on lava for 2 s", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);

    await moveOntoLava(page);
    await expect(page.locator("#reset-message")).toHaveText("Stand on Start, or put your mouse on it", {
      timeout: 5000,
    });
  });

  test("keeps the door shut until the player reaches the last section", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);

    await moveTo(page, "#door");
    await page.waitForTimeout(1500);
    await clickNow(page, "#door");
    await page.waitForTimeout(500);
    await expect(page.locator("#stage-link-bridge-across-lava")).toHaveCount(0); // still in the stage
    await expect(page.locator("#reset-message")).toHaveCount(0);
  });

  test("catches feet by the bridge's curve: just outside is lava, just inside is bridge", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);

    // Along a row through the middle of section 3 (which the curve may share with its neighbours), what is under each point
    const row = await page.evaluate(() => {
      const box = document.querySelector("#bridge-3")!.getBoundingClientRect();
      const y = box.y + box.height / 2;
      const ids: string[] = [];
      for (let x = box.x - 40; x < box.x + box.width + 40; x += 1) {
        const id = document.elementFromPoint(x, y)?.id ?? "";
        if (id !== ids.at(-1)) ids.push(id);
      }
      return ids;
    });
    expect(row).toContain("bridge-3");
    // Lava on both sides of it, and only bridge sections between: no gap in the curve, and nothing else catching feet
    expect([row[0], row.at(-1)]).toEqual(["lava", "lava"]);
    expect(row.slice(1, -1).every((id) => id.startsWith("bridge-"))).toBe(true);
  });

  test("hides section 4 as lava until the player reaches section 3", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);
    await expect(page.locator("#bridge-4")).toBeHidden();

    await walkOnto(page, 2);
    await expect(page.locator("#bridge-4")).toBeHidden();
    // Where it will be, a foot is on lava
    const [x, y] = await centreOf(page, "#bridge-4");
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id, [x, y])).toBe("lava");
  });

  test("section 4 appears through static over 2 s, then can be stood on", async ({ page }) => {
    await openDemo(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await crossingStart(page);
    await walkOnto(page, 2);
    await moveTo(page, "#bridge-3"); // not waiting for section 2 to fall, as that outlasts the static
    await expect(page.locator("#bridge-4")).toHaveClass(/appearing/);
    const started = Date.now();
    const [x, y] = await centreOf(page, "#bridge-4");
    // Static, not stone: lava still takes the foot while it appears
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id, [x, y])).toBe("lava");

    await expect(page.locator("#bridge-4")).not.toHaveClass(/appearing/, { timeout: 4000 });
    expect(Date.now() - started).toBeGreaterThan(1000);
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id, [x, y])).toBe("bridge-4");

    await walkOnto(page, 4);
    await expect(page.locator(".bridge-glow")).toHaveCount(0);
  });

  test("a foot where section 4 is, before it turns solid, is on lava", async ({ page }) => {
    await openDemo(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await crossingStart(page);
    await walkOnto(page, 2);
    await moveTo(page, "#bridge-3");
    await expect(page.locator("#bridge-4")).toHaveClass(/appearing/);

    await moveTo(page, "#bridge-4");
    await expect(page.locator(".bridge-glow")).toBeVisible();
    await expect(page.locator("#bridge-message")).toContainText("Get off the lava");
  });

  test("tints the whole screen while the warning shows", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);
    await moveOntoLava(page);
    await expect(page.locator(".bridge-glow")).toBeVisible();

    const glow = (await page.locator(".bridge-glow").boundingBox())!;
    const viewport = (await page.locator(".gameViewport").boundingBox())!;
    expect(glow.x).toBeCloseTo(viewport.x, 0);
    expect(glow.y).toBeCloseTo(viewport.y, 0);
    expect(glow.width).toBeCloseTo(viewport.width, 0);
    expect(glow.height).toBeCloseTo(viewport.height, 0);
  });

  test("counts a fallen section as lava", async ({ page }) => {
    await openDemo(page);
    await crossingStart(page);
    const first = (await page.locator("#bridge-1").boundingBox())!;

    await walkOnto(page, 2);
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);

    await expect(page.locator(".bridge-glow")).toBeVisible();
  });

  test("asks for the start again when the game is reloaded", async ({ page }) => {
    await openDemo(page);
    await page.locator("#stage-link-pits").click();
    await returnToStart(page);

    await page.reload();

    await expect(page.locator("#reset-message")).toHaveText("Stand on Start, or put your mouse on it");
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
      // A cover laid over the first pit, in the foreground; the rest of the foreground is empty
      challengeOf(game, "pits").foregroundTemplate = {
        sourceType: "embedded",
        content:
          '<div class="demo-screen" style="pointer-events: none">' +
          '<div id="cover" data-floor-area="18 52 42 68" style="background: #0008; pointer-events: auto"></div>' +
          "</div>",
      };
      challengeOf(game, "pits").foregroundTemplateStyle = { width: "100%", height: "100%" };
    });
    await page.locator("#stage-link-pits").click();
    await returnToStart(page);
    await expect(page.locator("#cover")).toBeVisible();

    await moveTo(page, "#pit-1");
    await expect(page.locator("#door-base")).toBeVisible();

    await moveTo(page, "#pit-2");
    await expect(page.locator("#reset-message")).toBeVisible();
  });

  test.describe("ring collection", () => {
    /** Opens the stage under a controllable clock, stands on Start, and runs out the 3-2-1 for the first ring. */
    const startRings = async (page: Page) => {
      await page.clock.install();
      await openDemo(page);
      await page.locator("#stage-link-rings").click();
      await page.locator("#reset-start").hover();
      await expect(page.locator("#reset-count")).toBeVisible();
      await page.clock.runFor(4000);
      await expect(page.locator("#ring-0")).toBeVisible();
      // From here only the test moves time
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10);
    };

    test("collects a ring by standing near it; the score rises and a new ring appears elsewhere", async ({ page }) => {
      await startRings(page);
      await expect(page.locator(".rings-scroll")).toHaveText("Collected 0 rings");
      const first = (await page.locator("#ring-0").boundingBox())!;

      await moveTo(page, "#ring-near-0");

      await expect(page.locator(".rings-scroll")).toHaveText("Collected 1 ring");
      await expect(page.locator("#ring-1")).toBeVisible();
      await expect(page.locator("#ring-0")).toHaveCount(0);
      const second = (await page.locator("#ring-1").boundingBox())!;
      expect(Math.abs(second.x - first.x) + Math.abs(second.y - first.y)).toBeGreaterThan(1);
    });

    test("the collected ring spins away", async ({ page }) => {
      await startRings(page);

      await moveTo(page, "#ring-near-0");

      const gone = page.locator("#ring-gone-1");
      await expect(gone).toBeVisible();
      const start = (await gone.boundingBox())!;
      await page.clock.runFor(100);
      await expect.poll(() => gone.evaluate((element) => element.getAnimations().length)).toBeGreaterThan(0);
      await expect
        .poll(
          async () =>
            Math.abs((await gone.boundingBox())!.x - start.x) + Math.abs((await gone.boundingBox())!.y - start.y),
        )
        .toBeGreaterThan(20);
    });

    test("the timer counts down from 30, a second at a time", async ({ page }) => {
      await startRings(page);
      const before = Number(await page.locator(".rings-timer").textContent());
      expect(before).toBeLessThanOrEqual(30);

      await page.clock.runFor(5000);

      await expect(page.locator(".rings-timer")).toHaveText(String(before - 5));
    });

    test("at 0 the ring goes and the score shows large, then the stage completes after 10 s", async ({ page }) => {
      await startRings(page);
      await moveTo(page, "#ring-near-0");
      await expect(page.locator("#ring-1")).toBeVisible();

      await page.clock.runFor(31_000);

      await expect(page.locator("#rings-final")).toHaveText("1");
      await expect(page.locator(".ring, .ring-gone")).toHaveCount(0);
      await page.clock.runFor(10_500);
      await expect(page.locator("#stage-link-rings")).toHaveClass(/completed/);
    });
  });
});
