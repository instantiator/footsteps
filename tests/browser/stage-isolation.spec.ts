import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { GameRepository } from "../../src/entities/GameRepository";

/** The demo game, whose stages each draw their own scene with nothing of the overview behind them. */
const GAME_ID = "rules-demo";

const repository = JSON.parse(readFileSync("public/game-repository.json", "utf8")) as GameRepository;
const stageIds = repository.games[GAME_ID].stages.map((stage) => stage.id);

for (const stageId of stageIds) {
  test(`shows nothing of the overview behind the ${stageId} stage`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/game/${GAME_ID}/play?noCamera=true`);
    await page.locator("#demo-title").click();
    await page.locator(`#stage-link-${stageId}`).click();
    await expect(page.locator(`#stage-link-${stageId}`)).toHaveCount(0);
    await expect(page.locator("#candle-left")).toHaveCount(0);
    await expect(page.locator(".demo-stages")).toHaveCount(0);
  });
}

test("fits every stage's link on the overview", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/game/${GAME_ID}/play?noCamera=true`);
  await page.locator("#demo-title").click();
  const viewport = page.viewportSize()!;
  for (const stageId of stageIds) {
    const box = (await page.locator(`#stage-link-${stageId}`).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
});
