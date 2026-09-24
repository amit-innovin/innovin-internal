import { expect, test, uniqueText, typePin } from "./fixtures";
import type { Browser } from "@playwright/test";

// The mock Google provider pins who signs in, then the round-trip completes in the browser.
const MOCK = "http://localhost:3999";
async function signInAs(browser: Browser, email: string, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.request.get(`${MOCK}/as?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
  await page.goto("/api/auth/google?next=/settings");
  await expect(page.getByText("Verified with Google")).toBeVisible();
  await page.request.get(`${MOCK}/as?reset=1`);
  return { ctx, page };
}

test.describe("10K Steps", () => {
  test("a signed-in walker logs a hit from home and appears on the board", async ({ browser }) => {
    const name = uniqueText("Wanda");
    const { ctx, page } = await signInAs(browser, `walker.${Date.now().toString(36)}@innovinlabs.com`, name);

    const card = page.locator("[data-slot=card]").filter({ hasText: "10K Steps" });
    await page.goto("/");
    await expect(card.getByText("Hit 10K today?")).toBeVisible();
    await card.getByRole("button", { name: /Yes, hit it/ }).click();
    await expect(page.getByText("10K — nice walking!")).toBeVisible();
    await expect(card.getByText("Done — you walked it")).toBeVisible();

    await page.goto("/steps");
    const row = page.locator("li", { hasText: name });
    await expect(row).toContainText("1 day");
    await expect(row.getByText("today")).toBeVisible();
    await ctx.close();
  });

  test("an exact step count decides the day — 9,500 misses, 12,400 hits", async ({ browser }) => {
    const { ctx, page } = await signInAs(browser, `counter.${Date.now().toString(36)}@innovinlabs.com`, uniqueText("Carl"));

    const card = page.locator("[data-slot=card]").filter({ hasText: "10K Steps" });
    await page.goto("/");
    await card.getByRole("button", { name: "Add your step count" }).click();
    await card.getByLabel("Today's step count").fill("9500");
    await card.getByRole("button", { name: "Log it" }).click();
    await expect(page.getByText("Logged as missed")).toBeVisible();

    // Same day stays editable — correct it to the real count.
    await card.getByRole("button", { name: "Add your step count" }).click();
    await card.getByLabel("Today's step count").fill("12400");
    await card.getByRole("button", { name: "Log it" }).click();
    await expect(card.getByText(/12,400|Done — you walked it/)).toBeVisible();
    await ctx.close();
  });

  test("unsigned visitors see the board but can't log", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[data-slot=card]").filter({ hasText: "10K Steps" });
    await expect(card.getByRole("link", { name: "Sign in to join" })).toBeVisible();
    await expect(card.getByRole("button", { name: /Yes, hit it/ })).toHaveCount(0);

    const res = await page.request.post("/api/steps", { data: { hit: true } });
    expect(res.status()).toBe(401);
  });

  test("an admin banks sheet days on a person and the board adds them", async ({ page, browser }) => {
    const name = uniqueText("Bill");
    const { ctx, page: walker } = await signInAs(browser, `banker.${Date.now().toString(36)}@innovinlabs.com`, name);
    await walker.goto("/steps");
    await expect(walker.locator("li", { hasText: name })).toHaveCount(0);

    await page.goto("/admin?tab=people");
    await typePin(page, "1704");
    await page.getByRole("searchbox", { name: "Search people" }).fill(name);
    await page.getByRole("button", { name: new RegExp(`Edit balances for ${name}`) }).click();
    await page.getByLabel(`Sheet days so far for ${name}`).fill("45");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    await walker.reload();
    await expect(walker.locator("li", { hasText: name })).toContainText("45 days");
    await ctx.close();
  });
});
