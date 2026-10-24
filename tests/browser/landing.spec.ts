import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  // The committed game needs the camera on one of its displays, so grant it before the landing check.
  await context.grantPermissions(["camera"]);
});

test("starts the game from the landing page at /play", async ({ page }) => {
  await page.goto("/game/magic-trifle");

  await expect(page.getByRole("heading", { level: 1, name: "Nanny's Magic Trifle" })).toBeVisible();
  await expect(page.getByText(/A rhyming Christmas treasure hunt/)).toBeVisible();
  await expect(page.locator(".game-permission-granted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Grant camera" })).toHaveCount(0);

  const style = await page.locator(".game-landing").evaluate((element) => {
    const computed = getComputedStyle(element);
    return { backgroundImage: computed.backgroundImage, fontFamily: computed.fontFamily };
  });
  expect(style.backgroundImage).toContain("games/magic-trifle/title/background.png");
  expect(style.fontFamily).toContain("DynaPuff");

  const newGame = page.getByRole("button", { name: "New game" });
  await expect(newGame).toBeEnabled();
  await newGame.click();

  await expect(page).toHaveURL(/\/game\/magic-trifle\/play$/);
  await expect(page.locator("#game-container")).toBeVisible();
});
