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
  test("a signed-in walker logs a count and appears on the board", async ({ browser }) => {
    const name = uniqueText("Wanda");
    const { ctx, page } = await signInAs(browser, `walker.${Date.now().toString(36)}@innovinlabs.com`, name);
    await page.goto("/steps");
    await page.getByLabel("Today's total steps").fill("10000");
    await page.getByRole("button", { name: "Save today's steps" }).click();
    await expect(page.getByText("Today's steps saved")).toBeVisible();
    await expect(page.locator(".ranking-list .is-me")).toContainText(name);
    await page.getByRole("button", { name: "10k+ days", exact: true }).click();
    await expect(page.locator(".ranking-list .is-me")).toContainText("1");
    await ctx.close();
  });

  test("an exact count decides the day and stays editable", async ({ browser }) => {
    const { ctx, page } = await signInAs(browser, `counter.${Date.now().toString(36)}@innovinlabs.com`, uniqueText("Carl"));
    await page.goto("/steps");
    for (const [count, hit] of [[9500, false], [12400, true]] as const) {
      await page.getByLabel("Today's total steps").fill(String(count));
      await page.getByRole("button", { name: "Save today's steps" }).click();
      await expect(page.getByText("Today's steps saved")).toBeVisible();
      const data = await (await page.request.get("/api/steps")).json();
      expect(data.me.today).toMatchObject({ steps: count, hit });
      await page.reload();
      await expect(page.getByLabel("Today's total steps")).toHaveValue(String(count));
    }
    await ctx.close();
  });

  test("unsigned visitors need Google to join and cannot log via the API", async ({ page }) => {
    await page.goto("/steps");
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save today's steps" })).toHaveCount(0);
    expect((await page.request.post("/api/steps", { data: { hit: true } })).status()).toBe(401);
  });

  test("an admin banks sheet days on a person and the board adds them", async ({ page, browser }) => {
    const name = uniqueText("Bill");
    const { ctx, page: walker } = await signInAs(browser, `banker.${Date.now().toString(36)}@innovinlabs.com`, name);
    await walker.goto("/steps");
    await expect(walker.locator(".ranking-list .is-me")).toHaveCount(0);

    await page.goto("/admin?tab=people");
    await typePin(page, "1704");
    await page.getByRole("searchbox", { name: "Search people" }).fill(name);
    await page.getByRole("button", { name: new RegExp(`Edit balances for ${name}`) }).click();
    await page.getByLabel(`Sheet days so far for ${name}`).fill("45");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    await walker.reload();
    await walker.getByRole("button", { name: "10k+ days", exact: true }).click();
    await expect(walker.locator(".ranking-list .is-me")).toContainText("45");
    await expect(walker.locator(".ranking-list .is-me")).toContainText("admin sheet total");
    await ctx.close();
  });
});
