import { expect, test } from "@playwright/test";

/** The 2D demo played by mouse alone, with no camera to grant or calibrate. */
const GAME_ID = "demo-no-camera";

test("plays the 2D demo to the end by mouse, and shows it complete on its tile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/game/${GAME_ID}`);
  const badges = page.getByRole("list", { name: "About this game" });
  await expect(badges).toContainText("2D");
  await expect(badges).toContainText("No camera");
  await expect(badges).toContainText("3 stages · 3 challenges");
  await expect(badges).toContainText("Sound effects");
  await expect(page.getByRole("combobox", { name: "Camera" })).toHaveCount(0);
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.locator("#character-camera-layer")).toHaveCount(0);

  await page.locator("#ndc-title").click();

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
  // The last challenge completes the game, which leaves the stages for its closing scene
  await expect(page.locator("#stage-link-doors")).toHaveCount(0);

  await page.goto("/");
  const tile = page.getByRole("link", { name: "Play Demo (no camera)" });
  await expect(tile.getByRole("list", { name: "About this game" })).toContainText("100% complete");
});
