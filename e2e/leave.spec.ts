import { adminLogin, adminTab, expect, test, uniqueEmail, uniqueText, signInEmployee } from "./fixtures";
import type { Page } from "@playwright/test";

// Leave, WFH requests and the month calendar all live inside Attendance now — one "my time"
// surface behind Today / Calendar / Leave tabs. Segmented renders role="tab".
const openTab = async (page: Page, name: "Today" | "Calendar" | "Leave") => {
  await page.getByRole("tab", { name }).click();
};

async function leaveTab(page: Page, path = "/attendance") {
  const me = await (await page.request.get("/api/auth/me")).json();
  if (!me.signedIn) await signInEmployee(page);
  await page.goto(path);
  await openTab(page, "Leave");
}

test.describe("Leave & calendar", () => {
  test("the old Leave and Time Away URLs redirect into Attendance", async ({ page }) => {
    await signInEmployee(page);
    for (const stale of ["/away", "/leave"]) {
      await page.goto(stale);
      await expect(page).toHaveURL(/\/attendance\?tab=leave$/);
      await expect(page.getByRole("heading", { level: 1, name: "Attendance" })).toBeVisible();
    }
    // Neither appears in the navigation any more.
    await expect(page.getByRole("link", { name: "Time Away" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Leave tracker" })).toHaveCount(0);
  });

  test("checking in stays the first thing after verified sign-in", async ({ page }) => {
    await page.goto("/attendance");
    await signInEmployee(page);
    // The daily action stays above the tabs after verified sign-in.
    await expect(page.getByRole("heading", { name: "Not checked in yet" })).toBeVisible();
    await expect(page.getByText(/Checking in as/)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Today" })).toBeVisible();
  });

  test("a WFH request is submitted and tracked on this device only", async ({ page, browser }) => {
    const email = uniqueEmail("away");
    const reason = uniqueText("plumber visit");
    await leaveTab(page);
    await page.getByRole("tab", { name: "Work from home" }).click();
    await page.locator("#away-start").fill("2026-10-07");
    await page.locator("#away-end").fill("2026-10-07");
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

  test("a signed-in request cannot use a forged email", async ({ page }) => {
    await leaveTab(page);
    const me = await (await page.request.get("/api/auth/me")).json();
    const res = await page.request.post("/api/away", { data: { email: "someone@gmail.com", type: "wfh", startDate: "2026-11-09", endDate: "2026-11-09" } });
    expect(res.status()).toBe(200);
    expect((await res.json()).email).toBe(me.email);
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

  test("plans change: a pending request can be cancelled, and admins see it without actions", async ({ page, browser }) => {
    const reason = uniqueText("plans changed");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await leaveTab(e);
    await e.locator("#away-start").fill("2026-11-09"); // Mon
    await e.locator("#away-end").fill("2026-11-10");
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();

    const row = e.locator("li", { hasText: reason });
    await expect(row.getByRole("button", { name: "Cancel" })).toBeVisible();
    e.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Cancel" }).click();
    await expect(row).toContainText("Cancelled");
    await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);

    await adminLogin(page, "approvals");
    const adminRow = page.locator("li", { hasText: reason });
    await expect(adminRow).toContainText("Cancelled");
    await expect(adminRow.getByRole("button")).toHaveCount(0);
    await employee.close();
  });

  test("an approved request can be cancelled — but only by its owner, and days return to the balance", async ({
    page,
    browser,
  }) => {
    const reason = uniqueText("approved then changed");
    const email = uniqueEmail("cancel2");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await leaveTab(e);
    await e.locator("#away-start").fill("2026-11-16"); // Mon
    await e.locator("#away-end").fill("2026-11-17");
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();

    await adminLogin(page, "approvals");
    await page.locator("li", { hasText: reason }).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved")).toBeVisible();

    // A different device holds no link to the request — the cancel is refused.
    const rows = await (await page.request.get("/api/away")).json();
    const id = rows.find((r: { reason: string }) => r.reason === reason)?.id;
    expect(id).toBeTruthy();
    const stranger = await browser.newContext();
    const denied = await stranger.request.patch("/api/away", { data: { id, status: "cancelled" } });
    expect(denied.status()).toBe(403);
    await stranger.close();

    // The owner's own device can, though — the approved days come back.
    await leaveTab(e);
    const row = e.locator("li", { hasText: reason });
    await expect(row).toContainText("Approved");
    e.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Cancel" }).click();
    await expect(row).toContainText("Cancelled");
    await employee.close();
  });

  test("time away already past can't be cancelled", async ({ page }) => {
    await signInEmployee(page);
    const res = await page.request.post("/api/away", {
      data: {
        email: uniqueEmail("past"),
        type: "wfh",
        startDate: "2026-09-21",
        endDate: "2026-09-21",
        reason: "past request",
      },
    });
    const row = await res.json();
    const cancel = await page.request.patch("/api/away", { data: { id: row.id, status: "cancelled" } });
    expect(cancel.status()).toBe(400);
    expect(await cancel.json()).toMatchObject({ error: expect.stringContaining("passed") });
  });

  test("balances need a signed-in identity, not just a device", async ({ page }) => {
    expect((await (await page.request.get("/api/leave")).json()).signedIn).toBe(false);
    await page.goto("/attendance");
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    await leaveTab(page);
    await expect(page.getByRole("button", { name: "Request Leave" })).toBeVisible();
    expect((await (await page.request.get("/api/leave")).json()).signedIn).toBe(true);
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

async function browseSeptember(page: Page) {
  const current = new Date();
  const distance = (current.getUTCFullYear() - 2026) * 12 + current.getUTCMonth() - 8;
  for (let i = 0; i < Math.abs(distance); i++) {
    await page.getByRole("button", { name: distance > 0 ? "Previous month" : "Next month" }).click();
  }
  await expect(page.getByRole("heading", { name: "September 2026" })).toBeVisible();
}

test.describe("Attendance calendar", () => {
  test("plots the month, explains weekly offs and lists upcoming holidays", async ({ page }) => {
    await signInEmployee(page);
    await openTab(page, "Calendar");
    await browseSeptember(page);
    // The month grid renders a button per day, plus the weekday header row.
    await expect(page.getByRole("button", { name: /^1 Sep/ })).toBeVisible();
    await expect(page.getByText("weekly off")).toBeVisible();
    await expect(page.getByText("present", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming holidays" })).toBeVisible();
  });

  test("labels a Sunday, a 2nd Saturday and a holiday from the policy engine", async ({ page }) => {
    await signInEmployee(page);
    await openTab(page, "Calendar");
    await browseSeptember(page);
    // Sep 2026: the 6th is a Sunday, the 12th the 2nd Saturday.
    await expect(page.getByRole("button", { name: /^6 Sep.*Sunday/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^12 Sep.*2nd Saturday/ })).toBeVisible();
    // Page back to August for Onam on the 26th.
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByRole("button", { name: /^26 Aug.*Onam/ })).toBeVisible();
  });

  test("a day expands to show where and when you checked in", async ({ page }) => {
    const email = uniqueEmail("cal");
    await signInEmployee(page, email);
    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();

    await openTab(page, "Calendar");
    // The aria-label is "<day> <month> — …" (IST), matching fmtShortDate's order.
    const parts = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
      .formatToParts(new Date())
      .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    await page.getByRole("button", { name: new RegExp(`^${parts.day} ${parts.month}.*still in`) }).click();
    await expect(page.getByText(/Location not shared|In office|Remote/).first()).toBeVisible();
  });

  test("no horizontal overflow with the calendar open", async ({ page }) => {
    await signInEmployee(page);
    await openTab(page, "Calendar");
    await expect(page.getByRole("heading", { name: "Upcoming holidays" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
