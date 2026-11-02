import { expect, test, type Page } from "@playwright/test";
import { MODEL_TIMEOUT } from "./fixtures/cameraGame";
import { installCameraDrawCounter } from "./fixtures/cameraDraws";
import { installFakeCamera } from "./fixtures/fakeCamera";
import { peoplePhotoUrls } from "./fixtures/people/people";

/** Opens the rules demo's depth stage, with a fake camera showing a person. */
const openDepthStage = async (page: Page, query = "") => {
  await page.context().grantPermissions(["camera"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installFakeCamera(page, peoplePhotoUrls());
  await installCameraDrawCounter(page);
  await page.goto(`/game/rules-demo/play${query}`);
  await page.locator("#demo-title").click({ force: true });
  await page.locator("#stage-link-depth").click();
  await expect(page.locator("#depth-far")).toBeVisible();
  await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
};

/** The z-index an element computes to. */
const zIndexOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => Number(getComputedStyle(element).zIndex));

test("sorts a player among the items, in one stacking context", async ({ page }) => {
  await openDepthStage(page);
  const canvas = "#character-canvas-container canvas";
  await expect.poll(() => zIndexOf(page, canvas), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(-1000);

  // The photo's person stands with their feet about 69% down: between the far post (45) and the near one (80)
  const [far, near, player] = await Promise.all([
    zIndexOf(page, "#depth-far"),
    zIndexOf(page, "#depth-near"),
    zIndexOf(page, canvas),
  ]);
  expect(far).toBe(-955);
  expect(near).toBe(-920);
  expect(player).toBeGreaterThan(far);
  expect(player).toBeLessThan(near);

  // Nothing between them and the stack may form a stacking context, or the z-indexes wouldn't compare
  const breaks = await page.evaluate(() => {
    const stack = document.querySelector(".depthStack")!;
    const ancestors = (element: Element) => {
      const found: string[] = [];
      for (let node = element.parentElement; node && node !== stack; node = node.parentElement) {
        const style = getComputedStyle(node);
        const positioned = style.position !== "static" && style.zIndex !== "auto";
        if (positioned || style.transform !== "none" || style.opacity !== "1" || style.isolation === "isolate") {
          found.push(node.id || node.className);
        }
      }
      return found;
    };
    return [...ancestors(document.querySelector("#depth-far")!), ...ancestors(document.querySelector("canvas")!)];
  });
  expect(breaks).toEqual([]);
});

test("paints a far post behind the player's canvas and a near one in front", async ({ page }) => {
  await openDepthStage(page);
  const canvas = page.locator("#character-canvas-container canvas").first();
  await expect
    .poll(() => canvas.evaluate((c) => Number(c.style.zIndex)), { timeout: MODEL_TIMEOUT })
    .toBeGreaterThan(-1000);

  const topmostAt = (selector: string) =>
    page.evaluate((target) => {
      const { left, top, width, height } = document.querySelector(target)!.getBoundingClientRect();
      const canvasElement = document.querySelector<HTMLCanvasElement>("#character-canvas-container canvas")!;
      canvasElement.style.pointerEvents = "auto"; // the silhouette takes no clicks, so let this check find it
      const stack = document.elementsFromPoint(left + width / 2, top + height / 2);
      canvasElement.style.pointerEvents = "";
      return stack
        .map((element) => element.id || element.tagName)
        .filter((id) => id === target.slice(1) || id === "CANVAS");
    }, selector);

  expect(await topmostAt("#depth-far")).toEqual(["CANVAS", "depth-far"]);
  expect(await topmostAt("#depth-near")).toEqual(["depth-near", "CANVAS"]);
});

test("keeps an item with no depth in front of the player, where a click still reaches it", async ({ page }) => {
  await openDepthStage(page);
  const done = page.locator("#depth-done");
  await expect
    .poll(() => zIndexOf(page, "#character-canvas-container canvas"), { timeout: MODEL_TIMEOUT })
    .toBeGreaterThan(-1000);

  await expect(done).toHaveCSS("z-index", "auto");
  await done.click();
  await expect(page.locator("#stage-link-depth")).toHaveClass(/completed/);
});

test("draws each player's depth as a line when debugging", async ({ page }) => {
  await openDepthStage(page, "?debug=true");
  const canvas = page.locator("#character-canvas-container canvas").first();
  await expect
    .poll(() => canvas.evaluate((c) => Number(c.style.zIndex)), { timeout: MODEL_TIMEOUT })
    .toBeGreaterThan(-1000);

  const hasDepthLine = () =>
    canvas.evaluate((element) => {
      const { width, height } = element as HTMLCanvasElement;
      const { data } = (element as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, width, height);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0 && data[i + 1] === 255 && data[i + 2] === 0 && data[i + 3] === 255) return true;
      }
      return false;
    });
  await expect.poll(hasDepthLine).toBe(true);
});
