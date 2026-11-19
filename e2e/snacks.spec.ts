import type { Browser } from "@playwright/test";
import { ADMIN_EMAIL, expect, test, uniqueEmail, uniqueText, signInEmployee, signInOffice } from "./fixtures";

// Tea & snacks (prototype: docs/design/m3/Prototype.dc.html, "Snacks"). Times are admin settings,
// so each test sets times that make "now" the state it needs, then puts the defaults back.
const DEFAULTS = { amAt: "11:00", amClose: "10:45", pmAt: "16:00", pmClose: "15:30", orderAt: "12:00" };

async function asAdmin(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInEmployee(page, ADMIN_EMAIL, "/");
  return {
    times: (t: object) => page.request.patch("/api/admin/snack-times", { data: { ...DEFAULTS, ...t } }),
    shelf: (name: string) => page.request.post("/api/snacks", { data: { name, shelf: true } }),
    close: () => context.close(),
  };
}

test.describe("Tea & snacks", () => {
  test("before checking in: one card that sends you to Home, and suggestions", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("snacks-gate"), "/snacks");
    const gate = page.getByRole("region", { name: "Tea & snacks are for people in the office today" });
    await expect(gate).toContainText("Check in on Home to book tea and pick a snack.");
    await expect(page.getByRole("heading", { name: "Today's snacks" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Suggestions for coming days" })).toBeVisible();
    await gate.getByRole("link", { name: "Check in" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("checked in: answer the tea round, pick one snack and switch it", async ({ page, browser }) => {
    const admin = await asAdmin(browser);
    const a = uniqueText("Samosa"), b = uniqueText("Fruit bowl");
    try {
      expect((await admin.times({ amAt: "23:58", amClose: "23:57", pmAt: "23:59", pmClose: "23:58", orderAt: "23:59" })).status()).toBe(200);
      await admin.shelf(a);
      await admin.shelf(b);
      await signInOffice(page, uniqueEmail("snacks-in"));
      await page.goto("/snacks");

      const tea = page.getByRole("region", { name: /Tea round at|on the tea list/ });
      await expect(tea).toContainText("Answer by");
      await tea.getByRole("button", { name: "Yes, I'll have tea" }).click();
      await expect(page.getByText(/You're on the list\./)).toBeVisible();
      await page.getByRole("button", { name: "Change answer" }).click();
      await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();

      const today = page.getByRole("region", { name: "Today's snacks" });
      const row = (name: string) => today.locator("div").filter({ hasText: name }).filter({ has: page.getByRole("button") }).last();
      await expect(today).toContainText("Nobody sees who picked what.");
      await row(a).getByRole("button", { name: "Pick this" }).click();
      await expect(row(a).getByRole("button", { name: "Your pick" })).toHaveAttribute("aria-pressed", "true");
      await row(b).getByRole("button", { name: "Switch to this" }).click();
      await expect(row(a).getByRole("button", { name: "Switch to this" })).toBeVisible();
      await row(b).getByRole("button", { name: "Your pick" }).click();
      await expect(row(b).getByRole("button", { name: "Pick this" })).toBeVisible();
      await page.screenshot({ path: `output/playwright/m3-snacks-${test.info().project.name}.png`, fullPage: true });
    } finally {
      await admin.times({});
      await admin.close();
    }
  });

  test("after the order time, picks are closed", async ({ page, browser }) => {
    const admin = await asAdmin(browser);
    try {
      await admin.shelf(uniqueText("Biscuits"));
      expect((await admin.times({ orderAt: "00:01" })).status()).toBe(200);
      await signInOffice(page, uniqueEmail("snacks-late"));
      await page.goto("/snacks");
      const today = page.getByRole("region", { name: "Today's snacks" });
      await expect(today).toContainText("Order placed");
      await expect(today).toContainText("Today's order is in. Picks open again tomorrow.");
      await expect(today.getByRole("button", { name: /Pick this|Switch to this/ })).toHaveCount(0);
    } finally {
      await admin.times({});
      await admin.close();
    }
  });

  test("answering just after the cut-off shows the closed round, not an error", async ({ page, browser }) => {
    const admin = await asAdmin(browser);
    try {
      expect((await admin.times({ amAt: "23:58", amClose: "23:57", pmAt: "23:59", pmClose: "23:58" })).status()).toBe(200);
      await signInOffice(page, uniqueEmail("snacks-cutoff"));
      await page.goto("/snacks");
      await expect(page.getByRole("button", { name: "Yes, I'll have tea" })).toBeVisible();
      // The cut-off passes while the page is open.
      expect((await admin.times({ amAt: "23:58", amClose: "00:01", pmAt: "23:59", pmClose: "23:58" })).status()).toBe(200);
      const answer = page.waitForResponse((r) => r.url().endsWith("/api/tea") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Yes, I'll have tea" }).click();
      expect((await answer).status()).toBe(409);
      await expect(page.getByText(/round is closed\./)).toBeVisible();
      // Checked at once: toHaveCount would wait for a toast to fade and pass anyway.
      expect(await page.locator("[data-sonner-toast]").count()).toBe(0);
    } finally {
      await admin.times({});
      await admin.close();
    }
  });
});
