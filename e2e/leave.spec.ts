import { adminLogin, adminTab, expect, test, uniqueEmail, uniqueText } from "./fixtures";
import type { Page } from "@playwright/test";

// Leave, WFH requests and the month calendar all live inside Attendance now — one "my time"
// surface behind Today / Calendar / Leave tabs. Segmented renders role="tab".
const openTab = async (page: Page, name: "Today" | "Calendar" | "Leave") => {
  await page.getByRole("tab", { name }).click();
};

async function leaveTab(page: Page, path = "/attendance") {
  await page.goto(path);
  await openTab(page, "Leave");
}

test.describe("Leave & calendar", () => {
  test("the old Leave and Time Away URLs redirect into Attendance", async ({ page }) => {
    for (const stale of ["/away", "/leave"]) {
      await page.goto(stale);
      await expect(page).toHaveURL(/\/attendance$/);
      await expect(page.getByRole("heading", { level: 1, name: "Attendance" })).toBeVisible();
    }
    // Neither appears in the navigation any more.
    await expect(page.getByRole("link", { name: "Time Away" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Leave tracker" })).toHaveCount(0);
  });

  test("checking in stays the first thing on the page and needs no sign-in", async ({ page }) => {
    await page.goto("/attendance");
    // The daily action is above the tabs and works with just a typed email.
    await expect(page.getByRole("heading", { name: "Not checked in yet" })).toBeVisible();
    await expect(page.getByLabel("Your Innovin email")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Today" })).toBeVisible();
  });

  test("a WFH request is submitted and tracked on this device only", async ({ page, browser }) => {
    const email = uniqueEmail("away");
    const reason = uniqueText("plumber visit");
    await leaveTab(page);
    await page.getByRole("tab", { name: "Work from home" }).click();
    await page.locator("#away-start").fill("2026-10-07");
    await page.locator("#away-end").fill("2026-10-07");
    await page.getByLabel("Email for this request").fill(email);
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Request WFH" }).click();
    await expect(page.getByText("Work from home request sent")).toBeVisible();

    const item = page.locator("li", { hasText: reason });
    await expect(item).toContainText("Work from home");
    await expect(item).toContainText("Pending");

    const other = await browser.newContext();
    const o = await other.newPage();
    await leaveTab(o);
    await expect(o.getByText(reason)).toHaveCount(0);
    await other.close();
  });

  test("a non-Innovin email is rejected inline", async ({ page }) => {
    await leaveTab(page);
    await page.locator("#away-start").fill("2026-10-08");
    await page.locator("#away-end").fill("2026-10-08");
    await page.getByLabel("Email for this request").fill("someone@gmail.com");
    await page.getByRole("button", { name: "Request Leave" }).click();
    await expect(page.getByText("Use your Innovin email")).toBeVisible();
  });

  test("the end date can't be picked before the start date", async ({ page }) => {
    await leaveTab(page);
    await page.locator("#away-start").fill("2026-10-20");
    await expect(page.locator("#away-end")).toHaveAttribute("min", "2026-10-20");
  });

  test("leave lifecycle: request → admin approves → employee sees Approved", async ({ page, browser }) => {
    const reason = uniqueText("family function");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await leaveTab(e);
    await e.locator("#away-start").fill("2026-10-12");
    await e.locator("#away-end").fill("2026-10-13");
    await e.getByLabel("Email for this request").fill(uniqueEmail("leave"));
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();

    await adminLogin(page, "approvals");
    await page.locator("li", { hasText: reason }).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved")).toBeVisible();

    await leaveTab(e);
    await expect(e.locator("li", { hasText: reason })).toContainText("Approved");
    await employee.close();
  });

  test("balances need a signed-in identity, not just a device", async ({ page }) => {
    await leaveTab(page);
    const balance = page.locator("[data-slot=card]").filter({ hasText: "Balance ·" });
    await expect(balance).toContainText("Sign in with Google");
    // Requesting still works unsigned — only the balances need identity.
    await expect(page.getByRole("button", { name: "Request Leave" })).toBeVisible();
  });

  test("a leave request moves from pending to used in the balance", async ({ page, browser }) => {
    const reason = uniqueText("balance check");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/api/auth/google?next=/attendance");
    await openTab(e, "Leave");
    await e.locator("#away-leave-type").selectOption("cl");
    await e.locator("#away-start").fill("2026-09-07"); // Mon
    await e.locator("#away-end").fill("2026-09-08"); // Tue
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();

    const casual = e.locator("li", { hasText: "Casual Leave" });
    await expect(casual).toContainText("2 pending");
    await expect(casual).toContainText("of 4 left"); // current policy entitlement

    await adminLogin(page, "approvals");
    await page.locator("li", { hasText: reason }).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved")).toBeVisible();
    await adminTab(page, "people");
    await expect(page.locator("#leave")).toContainText("Leave balances");

    await leaveTab(e);
    await expect(e.locator("li", { hasText: "Casual Leave" })).toContainText("2 of 4 left");
    await employee.close();
  });

  test("a non-working day is refused with the reason", async ({ page }) => {
    await leaveTab(page);
    await page.locator("#away-start").fill("2026-09-06"); // a Sunday
    await page.locator("#away-end").fill("2026-09-06");
    await page.getByLabel("Email for this request").fill(uniqueEmail("sun"));
    await page.getByRole("button", { name: "Request Leave" }).click();
    await expect(page.getByText(/non-working day \(Sunday\)/)).toBeVisible();
  });

  test("half-day Casual Leave costs half a day", async ({ page }) => {
    const reason = uniqueText("half day");
    await page.goto("/api/auth/google?next=/attendance");
    await openTab(page, "Leave");
    await page.locator("#away-leave-type").selectOption("cl");
    await page.getByLabel(/Half day/).check();
    await page.locator("#away-start").fill("2026-09-09");
    await page.locator("#away-end").fill("2026-09-09");
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Request Leave" }).click();
    await expect(page.getByText("Leave request sent")).toBeVisible();
    await expect(page.locator("li", { hasText: "Casual Leave" })).toContainText("0.5 pending");
  });
});

test.describe("Attendance calendar", () => {
  test("plots the month, explains weekly offs and lists upcoming holidays", async ({ page }) => {
    await page.goto("/attendance");
    await openTab(page, "Calendar");
    // The month grid renders a button per day, plus the weekday header row.
    await expect(page.getByRole("button", { name: /^1 Sep/ })).toBeVisible();
    await expect(page.getByText("weekly off")).toBeVisible();
    await expect(page.getByText("present", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming holidays" })).toBeVisible();
  });

  test("labels a Sunday, a 2nd Saturday and a holiday from the policy engine", async ({ page }) => {
    await page.goto("/attendance");
    await openTab(page, "Calendar");
    // Sep 2026: the 6th is a Sunday, the 12th the 2nd Saturday.
    await expect(page.getByRole("button", { name: /^6 Sep.*Sunday/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^12 Sep.*2nd Saturday/ })).toBeVisible();
    // Page back to August for Onam on the 26th.
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByRole("button", { name: /^26 Aug.*Onam/ })).toBeVisible();
  });

  test("a day's sessions expand with times, location and duration", async ({ page }) => {
    const email = uniqueEmail("cal");
    await page.goto("/attendance");
    await page.getByLabel("Your Innovin email").fill(email);
    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();

    await openTab(page, "Calendar");
    // The aria-label is "<day> <month> — …" (IST), matching fmtShortDate's order.
    const parts = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
      .formatToParts(new Date())
      .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    await page.getByRole("button", { name: new RegExp(`^${parts.day} ${parts.month}.*session`) }).click();
    await expect(page.getByText("in progress")).toBeVisible();
    await expect(page.getByText(/Location not shared|In office|Remote/).first()).toBeVisible();
  });

  test("no horizontal overflow with the calendar open", async ({ page }) => {
    await page.goto("/attendance");
    await openTab(page, "Calendar");
    await expect(page.getByRole("heading", { name: "Upcoming holidays" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
