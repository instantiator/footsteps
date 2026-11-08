import { expect, test } from "@playwright/test";
import { installFakeCamera } from "./fixtures/fakeCamera";

test.beforeEach(async ({ context }) => {
  // The committed game needs the camera on one of its scenes, so grant it before the landing check.
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

test("plays with the camera chosen on the landing page, and shows no picker without a grant", async ({
  page,
  context,
}) => {
  await installFakeCamera(page);
  await page.goto("/game/magic-trifle");

  const dropdown = page.getByRole("combobox", { name: "Camera" });
  await expect(page.getByRole("option", { name: "Fake rear camera" })).toBeAttached();
  await expect(page.getByLabel("Camera preview")).toBeVisible();
  await dropdown.selectOption("fake-rear");
  await expect(page.getByRole("option", { name: "✓ Fake rear camera" })).toBeAttached();

  await page.getByRole("button", { name: "New game" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.locator("#magic-trifle-title").click({ force: true }); // the title has no camera; the overview does
  const lastAsked = () =>
    page.evaluate(() => {
      const video = window.__fakeCamera.constraints.at(-1)?.video;
      return typeof video === "object" ? video.deviceId : undefined;
    });
  await expect.poll(lastAsked, { timeout: 20_000 }).toEqual({ exact: "fake-rear" });

  await context.clearPermissions();
  await page.goto("/game/magic-trifle");
  await expect(page.getByRole("combobox", { name: "Camera" })).toHaveCount(0);
});
