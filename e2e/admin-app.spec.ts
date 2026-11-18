import type { Browser } from "@playwright/test";
import { ADMIN_EMAIL, expect, test, uniqueEmail, uniqueText, signInEmployee, signInOffice } from "./fixtures";

// The admin app (prototype: docs/design/m3/M3AdminApp.dc.html, M3AdminAppPhone.dc.html): its own
// shell, "Needs you" first, no vanity numbers or explainer copy.
const admin = (page: import("@playwright/test").Page, path = "/admin") => signInEmployee(page, ADMIN_EMAIL, path);
const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Admin" }).filter({ visible: true });

async function member(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(prefix);
  await signInOffice(page, email);
  return { page, email, close: () => context.close() };
}

test.describe("Admin app", () => {
  test("its own shell, Needs you first, and a way back to the member app", async ({ page }) => {
    await admin(page);
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    const needs = page.getByRole("region", { name: "Needs you" });
    await expect(needs).toBeVisible();
    // Needs you comes before the day's numbers.
    const order = await page.locator("[aria-label='Needs you'], [aria-label='Today in the office']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(order[0]).toBe("Needs you");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0); // no member navigation in here
    await expect(page.getByRole("link", { name: /member app/i }).filter({ visible: true }).first()).toHaveAttribute("href", "/");
    await page.screenshot({ path: `output/playwright/admin-today-${test.info().project.name}.png`, fullPage: true });
  });

  test("members can't open it", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("not-admin"), "/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("People: pick someone, add their birthday, and fix a past day", async ({ page, browser }) => {
    const someone = await member(browser, `pp${Date.now().toString(36)}`);
    const name = someone.email.split("@")[0].split(".")[0].replace(/^./, (c) => c.toUpperCase());
    await someone.close();
    await admin(page, "/admin/people");
    await page.getByRole("searchbox", { name: "Find people" }).fill(name);
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
    const panel = page.getByRole("region", { name });
    await panel.getByLabel("Birthday day").selectOption("18");
    await panel.getByLabel("Birthday month").selectOption("11");
    await panel.getByRole("button", { name: "Save birthday" }).click();
    await expect(page.getByText("Birthday saved")).toBeVisible();
    await panel.getByRole("button", { name: "Fix a day" }).click();
    const fix = page.getByRole("dialog", { name: "Fix a day" });
    await fix.getByRole("radio", { name: "In office", exact: true }).click();
    await fix.getByRole("button", { name: "Save" }).click();
    await expect(fix).toHaveCount(0);
  });

  test("People: a month grid of who was in on which day, with no counts or verdicts", async ({ page, browser }) => {
    const someone = await member(browser, `grid${Date.now().toString(36)}`);
    const name = someone.email.split("@")[0].split(".")[0].replace(/^./, (c) => c.toUpperCase());
    await someone.close();
    await admin(page, "/admin/people");
    const grid = page.getByRole("region", { name: /^Office days · / });
    await expect(grid.getByRole("table")).toBeVisible();
    const row = grid.getByRole("row").filter({ has: page.getByRole("rowheader", { name }) });
    const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date()).replace(",", "");
    await expect(row.getByText(`${today}: In office`)).toHaveCount(1);
    await expect(page.getByText(/\b\d+\/\d+\b|\bBehind\b|On track|of 8 office days/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Everyone", exact: true })).toBeVisible();
    await grid.getByRole("button", { name }).click();
    await expect(page.getByRole("region", { name })).toBeVisible();

    await page.goto("/admin");
    const todayCard = page.getByRole("region", { name: "Today in the office" });
    await expect(todayCard).toContainText(name);
    await expect(todayCard.getByText(/^\d+$/)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Needs you" })).not.toContainText("behind");
  });

  test("Speak up: keep a reported post; reply to a message", async ({ page, browser }) => {
    const author = await member(browser, "admin-author");
    const body = uniqueText("Reported quote");
    await author.page.request.post("/api/notices", { data: { kind: "quote", body, title: "", attribution: "", color: "purple", anonymous: false } });
    await author.close();
    const reporter = await member(browser, "admin-reporter");
    const post = (await (await reporter.page.request.get("/api/feed")).json()).posts.find((p: { body?: string }) => p.body === body);
    await reporter.page.request.post("/api/notices/report", { data: { id: post.id } });
    const message = uniqueText("Lights flicker in the meeting room");
    await reporter.page.request.post("/api/grievances", { data: { body: message, topic: "Facilities" } });
    await reporter.close();

    await admin(page, "/admin/speak-up");
    const reported = page.getByRole("region", { name: "Reported posts" });
    const row = reported.locator("li, .m3-row").filter({ hasText: body });
    await row.getByRole("button", { name: /^Keep/ }).click();
    await expect(reported.getByText(body)).toHaveCount(0);
    const msg = page.locator("article, li, .m3-card").filter({ hasText: message }).first();
    await msg.getByLabel("Note the sender sees").fill("Electrician booked for Friday");
    await msg.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("Publish: an announcement reaches a member as a dialog", async ({ page, browser }) => {
    await admin(page, "/admin/publish");
    const title = uniqueText("Pantry closed for cleaning");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Message").fill("Back by 2 pm.");
    await page.getByRole("button", { name: "Publish announcement" }).click();
    await expect(page.getByRole("region", { name: "Published" })).toContainText(title);
    await expect(page.getByRole("region", { name: "Published" })).toContainText(/Seen by 0 of \d+/);

    const someone = await member(browser, "admin-reader");
    try {
      for (let i = 0; i < 20; i++) {
        const next = (await (await someone.page.request.get("/api/announcements/important")).json()).announcement;
        if (!next || next.title === title) break;
        await someone.page.request.post("/api/announcements/ack", { data: { id: next.id } });
      }
      await someone.page.goto("/days");
      await expect(someone.page.getByRole("dialog", { name: "Important announcement" })).toContainText(title);
    } finally {
      // Every announcement shows to everyone as a dialog: leaving it up would cover later tests' pages.
      const mine = (await (await page.request.get("/api/announcements")).json()).find((a: { title: string }) => a.title === title);
      if (mine) await page.request.post("/api/announcements", { form: { _action: "delete", id: mine.id }, maxRedirects: 0 });
      await someone.close();
    }
  });

  test("Office: mark today's snack order ordered, and add a closed day", async ({ page }) => {
    await admin(page, "/admin/office");
    await page.getByRole("tab", { name: "Snack shelf" }).click();
    const order = page.getByRole("region", { name: "Today's order" });
    await order.getByRole("button", { name: "Mark ordered" }).click();
    await expect(order).toContainText(/Ordered at \d{1,2}:\d{2}/);
    // A mis-tap would close picks for everyone until tomorrow: Undo reopens them.
    await order.getByRole("button", { name: "Undo" }).click();
    await expect(order).toContainText(/Goes in at/);
    await page.getByRole("tab", { name: "Closed days" }).click();
    const date = new Date(Date.now() + 5.5 * 3600_000 + 40 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Date").fill(date);
    await page.getByLabel("Reason").fill("Annual offsite");
    await page.getByRole("button", { name: "Mark closed" }).click();
    await expect(page.getByRole("region", { name: "Upcoming closed days" })).toContainText("Annual offsite");
    await page.getByRole("region", { name: "Upcoming closed days" }).getByRole("button", { name: /^Remove / }).last().click();
  });

  test("no explainer copy or vanity totals", async ({ page }) => {
    await admin(page, "/admin/office");
    await page.getByRole("tab", { name: "Snack shelf" }).click();
    await expect(page.getByText(/anonymous, totals only|You only ever see totals|picks so far/)).toHaveCount(0);
    await page.goto("/admin/speak-up");
    await expect(page.getByText(/What the sender sees|Anonymous by design/)).toHaveCount(0);
  });
});
