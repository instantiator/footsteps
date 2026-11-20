import { expect, test } from "@playwright/test";
import { DEFAULT_CORNERS } from "../../src/components/camera/FloorGeometry";
import { MODEL_TIMEOUT, seedCalibration } from "./fixtures/cameraGame";
import { installFakeCamera } from "./fixtures/fakeCamera";
import { peoplePhotoUrls } from "./fixtures/people/people";

test.beforeEach(async ({ context }) => {
  // The committed game needs the camera on one of its scenes, so grant it before the landing check.
  await context.grantPermissions(["camera"]);
});

test("starts the game from the landing page at /play", async ({ page }) => {
  await seedCalibration(page); // the game is 2.5D, so a granted camera needs a floor
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

test("plays with the camera chosen on the landing page, and opens no camera without a grant", async ({
  page,
  context,
}) => {
  await installFakeCamera(page);
  await seedCalibration(page, DEFAULT_CORNERS, "fake-rear"); // the camera chosen below
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

  // Without a grant, the dropdown offers only the system default and playing without, and lists no cameras
  await context.clearPermissions();
  await page.goto("/game/magic-trifle");
  await expect(page.getByRole("combobox", { name: "Camera" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Play without the camera" })).toBeAttached();
  await expect(page.getByRole("option", { name: /Fake rear camera/ })).toHaveCount(0);
});

test("holds a 2.5D game back until the floor is calibrated, and calibrates it", async ({ page }) => {
  await installFakeCamera(page, peoplePhotoUrls());
  await page.goto("/game/rules-demo/play");
  // A direct link to play goes back to the landing page to calibrate first
  await expect(page).toHaveURL(/\/game\/rules-demo$/);

  const newGame = page.getByRole("button", { name: "New game" });
  await expect(page.getByText("Not yet calibrated")).toBeVisible();
  await expect(newGame).toBeDisabled();
  await expect(page.locator(".game-camera-preview polygon")).toHaveCount(0);

  await page.getByRole("link", { name: "Calibrate", exact: true }).click();
  const calibrating = page.getByRole("heading", { level: 2, name: /^Calibrating:/ });
  await expect(page).toHaveURL(/\/game\/rules-demo\/calibrate$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Floor calibration");
  await expect(calibrating).toHaveText(/\*$/);
  // One person in view has their head, hands and feet marked
  await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
  await expect(page.locator(".calibration .floorMarker").first()).toBeAttached({ timeout: MODEL_TIMEOUT });
  await expect(page.getByText("Only one person should be in view")).toHaveCount(0);
  const backLeft = page.getByRole("button", { name: "Back left corner" });
  await backLeft.focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Save and close" }).click();
  await expect(page).toHaveURL(/\/game\/rules-demo$/);
  await expect(page.locator(".game-camera-preview polygon")).toBeAttached();
  await expect(page.getByText("Not yet calibrated")).toHaveCount(0);
  await expect(newGame).toBeEnabled();
  await newGame.click();
  await expect(page.locator("#game-container")).toBeVisible();
});

test("shows each game's badges on its tile and its landing page, and plays without the camera when asked", async ({
  page,
}) => {
  await page.goto("/");
  const tile = page.getByRole("link", { name: "Play Demo scenes" });
  const tileBadges = tile.getByRole("list", { name: "About this game" });
  await expect(tileBadges).toContainText("2.5D");
  await expect(tileBadges).toContainText("2D"); // the moved 2D stages
  await expect(tileBadges).toContainText("Camera optional");
  await expect(tileBadges).toContainText(/\d+ stages · \d+ challenges/);
  await expect(tileBadges).not.toContainText("% complete");

  await tile.click();
  await expect(page).toHaveURL(/\/game\/rules-demo$/);
  await expect(page.getByRole("list", { name: "About this game" })).toContainText("Camera optional");
  // No floor is calibrated, which only the camera needs
  await expect(page.getByText("Not yet calibrated")).toBeVisible();
  await page.getByRole("combobox", { name: "Camera" }).selectOption({ label: "Play without the camera" });
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page).toHaveURL(/\/play\?noCamera=true$/);
  await expect(page.locator("#game-container")).toBeVisible();
  await expect(page.locator("#character-camera-layer")).toHaveCount(0);
});
