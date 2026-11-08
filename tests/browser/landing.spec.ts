import { expect, test } from "@playwright/test";
import { MODEL_TIMEOUT } from "./fixtures/cameraGame";
import { installFakeCamera } from "./fixtures/fakeCamera";
import { peoplePhotoUrls } from "./fixtures/people/people";

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

test("holds a 2.5D game back until the floor is calibrated, and calibrates it", async ({ page }) => {
  await installFakeCamera(page, peoplePhotoUrls());
  await page.goto("/game/rules-demo/play");
  // A direct link to play goes back to the landing page to calibrate first
  await expect(page).toHaveURL(/\/game\/rules-demo$/);

  const newGame = page.getByRole("button", { name: "New game" });
  await expect(page.getByText("Calibrate the floor before you start.")).toBeVisible();
  await expect(newGame).toBeDisabled();
  await expect(page.getByText(/This camera has no saved floor area yet/)).toBeVisible();
  await expect(page.locator(".game-camera-preview polygon")).toBeAttached();

  await page.getByRole("link", { name: "Calibrate the floor" }).click();
  const saved = page.locator(".calibration-actions").getByRole("status");
  await expect(page).toHaveURL(/\/game\/rules-demo\/calibrate$/);
  await expect(saved).toHaveText("Not saved yet");
  // One person in view has their head, hands and feet marked
  await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
  await expect(page.locator(".calibration .floorMarker").first()).toBeAttached({ timeout: MODEL_TIMEOUT });
  await expect(page.getByText("Only one person should be in view")).toHaveCount(0);
  const backLeft = page.getByRole("button", { name: "Back left corner" });
  await backLeft.focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(saved).toHaveText("Saved");

  await page.getByRole("link", { name: "Back to the game" }).click();
  await expect(page.getByText(/This camera has a saved floor area/)).toBeVisible();
  await expect(newGame).toBeEnabled();
  await newGame.click();
  await expect(page.locator("#game-container")).toBeVisible();
});
