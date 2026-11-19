import type { Browser } from "@playwright/test";
import { expect, test, uniqueEmail, signInEmployee } from "./fixtures";

// The Material 3 10K steps screen (prototype: docs/design/m3/Prototype.dc.html, "Steps"). The
// league is opt-in: only people who join are listed, nudged, or can nudge.
async function walker(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(prefix);
  await signInEmployee(page, email, "/");
  return { page, email, name: prefix.replace(/^./, (c) => c.toUpperCase()), close: () => context.close() };
}

test.describe("10K steps", () => {
  test("steps added through the day add up", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("steps-add"), "/steps");
    const today = page.getByRole("region", { name: /\/ 10,000/ });
    for (const total of ["2,500", "5,000"]) {
      await page.getByRole("textbox", { name: "Add steps from your phone's step counter" }).fill("2500");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(today).toContainText(total);
    }
    await page.reload();
    await expect(today).toContainText("5,000");
    await expect(page.getByRole("region", { name: "Last 7 days" })).toBeVisible();
  });

  test("join the league, nudge someone once, and leave", async ({ page, browser }) => {
    const prefix = `sl${Date.now().toString(36)}`;
    const other = await walker(browser, prefix);
    await other.page.request.post("/api/steps", { data: { add: 4000 } });
    await other.page.request.post("/api/steps/league", { data: { on: true } });
    await other.close();

    await signInEmployee(page, uniqueEmail("steps-me"), "/steps");
    await page.request.post("/api/steps", { data: { add: 3000 } });
    await page.reload();
    await page.getByRole("button", { name: "Join the league" }).click();
    const league = page.getByRole("region", { name: "Step league" });
    await expect(league).toContainText("(you)");
    await expect(league).toContainText(/steps to pass|You're leading/);
    await league.getByRole("button", { name: `Nudge ${other.name}` }).click();
    await expect(league.getByRole("button", { name: `Nudged ${other.name}` })).toBeDisabled();
    await league.getByRole("button", { name: "Leave the league" }).click();
    await expect(page.getByRole("button", { name: "Join the league" })).toBeVisible();
    await page.screenshot({ path: `output/playwright/m3-steps-${test.info().project.name}.png`, fullPage: true });
  });

  test("signed-out visitors can't log steps", async ({ request }) => {
    expect((await request.post("/api/steps", { data: { add: 100 } })).status()).toBe(401);
  });
});
