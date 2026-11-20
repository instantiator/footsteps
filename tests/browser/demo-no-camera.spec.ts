import { expect, test } from "@playwright/test";

/** The 2D demo stages, played by mouse alone, with no camera. */
const GAME_ID = "rules-demo";

test("plays the 2D demo stages by mouse, without the camera", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/game/${GAME_ID}/play?noCamera=true`);
  await expect(page.locator("#character-camera-layer")).toHaveCount(0);

  await page.locator("#demo-title").click();

  await page.locator("#stage-link-lamps").click();
  await page.getByRole("button", { name: "Lamp 1" }).click();
  await page.getByRole("button", { name: "Lamp 2" }).click();
  await page.getByRole("button", { name: "Lamp 2" }).click(); // out again
  await expect(page.getByRole("button", { name: "Lamp 2" })).not.toHaveClass(/lit/);
  await page.getByRole("button", { name: "Lamp 2" }).click();
  await page.getByRole("button", { name: "Lamp 3" }).click();
  await expect(page.getByText("All lit. Well done!")).toBeVisible();
  await expect(page.locator("#stage-link-lamps")).toHaveClass(/completed/);

  await page.locator("#stage-link-riddle").click();
  await page.getByLabel("Next page").click();
  await page.locator('input[name="answer"]').fill("Keyboard");
  await expect(page.locator("#stage-link-riddle")).toHaveClass(/completed/);

  await page.locator("#stage-link-doors").click();
  await page.getByRole("button", { name: "Red door" }).click();
  await expect(page.locator("#doors-message")).toHaveText("Not that one. Try another.");
  await page.getByRole("button", { name: "Green door" }).click();
  await expect(page.locator("#stage-link-doors")).toHaveClass(/completed/);
});
