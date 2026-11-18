import { expect, test } from "@playwright/test";

/** The setup planner: the recommendation follows the values typed or stepped in. */
test("recommends a floor, and recalculates as the room changes", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { level: 1, name: "Plan your space" })).toBeVisible();
  const floor = page.getByRole("row", { name: /^Floor/ }).getByRole("cell");
  const before = await floor.textContent();
  expect(before).toMatch(/m wide × .* m deep/);

  const roomLength = page.getByLabel("Room length (camera's wall to far wall)", { exact: true });
  // The prerendered page shows before React takes it over, and a value typed before then is lost
  await expect(async () => {
    await roomLength.fill("3.5");
    await expect(floor).not.toHaveText(before ?? "", { timeout: 500 });
  }).toPass();

  const after = await floor.textContent();
  await page.getByRole("button", { name: "Increase room length (camera's wall to far wall)" }).click();
  await expect(roomLength).toHaveValue("3.55");
  await expect(floor).not.toHaveText(after ?? "");
});
