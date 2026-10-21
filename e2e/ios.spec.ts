import { expect, test, signInOffice, uniqueText } from "./fixtures";

async function withinViewport(page: import("@playwright/test").Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function capture(page: import("@playwright/test").Page, name: string) {
  const close = page.getByRole("button", { name: "Close toast", exact: true });
  for (let i = 0; i < 5 && await close.count(); i++) {
    const before = await close.count();
    await close.first().click();
    await expect(close).toHaveCount(before - 1);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `output/playwright/${name}-${test.info().project.name}.png`, fullPage: true, animations: "disabled" });
}

test.describe("iPhone workspace", () => {
  test("wallet fits Safari with readable headers and comfortable touch targets", async ({ page }) => {
    await signInOffice(page);
    await expect(page.locator(".phone-dynamic-island")).not.toBeVisible();
    await expect(page.locator(".phone-id-back")).toHaveCSS("visibility", "hidden");
    for (const name of ["Edit profile", "Expand Pantry", "Expand People in Office", "Expand Events", "Flip workspace pass", "In office", "Remote"]) {
      const control = page.getByRole("button", { name, exact: true });
      await expect(control).toBeVisible();
      const size = await control.boundingBox();
      expect(size!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(size!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
    const headers = page.locator(".phone-card-header-bar");
    for (const header of await headers.all()) {
      expect(await header.evaluate(e => e.scrollWidth <= e.clientWidth), "card header does not clip").toBe(true);
    }
    await withinViewport(page);
    await capture(page, "ios-wallet");
  });

  test("the pass flips to a readable calendar and back to the employee identity", async ({ page }) => {
    await signInOffice(page);
    await page.getByRole("button", { name: "Flip workspace pass", exact: true }).click();
    await expect(page.locator(".phone-id-front")).toHaveCSS("visibility", "hidden");
    await expect(page.locator(".phone-id-back")).toHaveCSS("visibility", "visible");
    await expect(page.getByText("YOUR PERSONAL CALENDAR", { exact: true })).toBeVisible();
    await capture(page, "ios-pass-calendar");
    await page.getByRole("button", { name: "Close pass calendar", exact: true }).click();
    await expect(page.locator(".phone-id-back")).toHaveCSS("visibility", "hidden");
    await expect(page.locator(".phone-id-name")).toBeVisible();
    await withinViewport(page);
  });

  test("pantry expands naturally, saves selections and keeps the cart reachable", async ({ page }) => {
    await signInOffice(page);
    await page.getByRole("button", { name: "Expand Pantry", exact: true }).click();
    const search = page.getByRole("searchbox", { name: "Search pantry" });
    expect(await search.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
    await search.fill("Tea");
    await page.getByRole("button", { name: "Add Tea", exact: true }).click();
    await page.getByRole("button", { name: "Clear pantry search" }).click();
    const cart = page.locator(".pantry-cart-items");
    await expect(cart).toContainText("Tea");
    await expect(page.getByRole("link", { name: /Notes.*history/ })).toBeVisible();
    const expanded = page.locator(".card-pantry-snacks.is-expanded");
    expect(await expanded.evaluate(e => e.scrollHeight <= e.clientHeight + 1), "expanded card contains all of its content").toBe(true);
    await withinViewport(page);
    await capture(page, "ios-pantry");
    await page.getByRole("button", { name: "Close pantry", exact: true }).click();
    await page.getByRole("button", { name: "Expand Pantry", exact: true }).click();
    await expect(cart).toContainText("Tea");
    expect((await (await page.request.get("/api/snacks?scope=mine")).json()).items.some((r: { itemId: string }) => r.itemId === "tea")).toBe(true);
  });

  test("profile and note dialogs stay inside the viewport and dismiss cleanly", async ({ page }) => {
    await signInOffice(page);
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(8);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 8);
    const title = page.getByLabel("Job title");
    expect(await title.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
    await title.fill("Senior Product Experience Designer");
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".phone-id-role")).toContainText("Senior Product Experience Designer");
    await page.getByRole("button", { name: "Office Notice Board", exact: true }).click();
    await page.getByRole("button", { name: "Post Note", exact: true }).click();
    await dialog.getByLabel("Your board note").fill(uniqueText("A small thought for the team"));
    await dialog.getByLabel("Post anonymously").check();
    await dialog.getByRole("button", { name: "Pin to board", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Anonymous Teammate", { exact: true }).last()).toBeVisible();
    await withinViewport(page);
    await capture(page, "ios-board");
  });

  test("steps and planner work in Safari without losing edits", async ({ page }) => {
    await signInOffice(page);
    await page.getByRole("link", { name: "Daily Steps & Prize", exact: true }).click();
    const count = page.getByLabel("Today's total steps");
    await count.fill("12880");
    await page.getByRole("button", { name: "Save today's steps", exact: true }).click();
    await expect(page.getByText("Today's steps saved")).toBeVisible();
    await page.reload();
    await expect(count).toHaveValue("12880");
    await capture(page, "ios-steps");
    await page.getByRole("link", { name: "Leave & WFH Planner", exact: true }).click();
    await page.getByRole("button", { name: /Select .*15$/ }).click();
    await page.getByRole("button", { name: "🌴 Vacation", exact: true }).click();
    await expect(page.getByText("Calendar updated")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Select .*15$/ })).toContainText("🌴");
    await withinViewport(page);
    await capture(page, "ios-planner");
  });
});
