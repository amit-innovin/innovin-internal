import { adminLogin, expect, test, uniqueEmail, uniqueText } from "./fixtures";

test.describe("Time Away", () => {
  test("a WFH request is submitted and tracked on this device only", async ({ page, browser }) => {
    const email = uniqueEmail("away");
    const reason = uniqueText("plumber visit");
    await page.goto("/away");
    await expect(page.getByRole("heading", { level: 1, name: "Time Away" })).toBeVisible();
    await page.getByRole("tab", { name: "Work from home" }).click();
    await page.locator("#away-start").fill("2026-10-07");
    await page.locator("#away-end").fill("2026-10-07");
    await page.getByLabel("Your Innovin email").fill(email);
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Request WFH" }).click();
    await expect(page.getByText("Work from home request sent")).toBeVisible();

    const item = page.locator("li", { hasText: reason });
    await expect(item).toContainText("Work from home");
    await expect(item).toContainText("Pending");

    const other = await browser.newContext();
    const o = await other.newPage();
    await o.goto("/away");
    await expect(o.getByText(reason)).toHaveCount(0);
    await other.close();
  });

  test("a non-Innovin email is rejected inline", async ({ page }) => {
    await page.goto("/away");
    await page.locator("#away-start").fill("2026-10-08");
    await page.locator("#away-end").fill("2026-10-08");
    await page.getByLabel("Your Innovin email").fill("me@gmail.com");
    await page.getByRole("button", { name: "Request Leave" }).click();
    await expect(page.getByText("Use your Innovin email")).toBeVisible();
  });

  test("the end date can't be picked before the start date", async ({ page }) => {
    await page.goto("/away");
    await page.locator("#away-start").fill("2026-10-08");
    await expect(page.locator("#away-end")).toHaveAttribute("min", "2026-10-08");
  });

  test("leave lifecycle: request → admin approves → employee sees Approved", async ({ page, browser }) => {
    const reason = uniqueText("family function");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/away");
    await e.locator("#away-start").fill("2026-10-01");
    await e.locator("#away-end").fill("2026-10-02");
    await e.getByLabel("Your Innovin email").fill(uniqueEmail("leave"));
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.locator("li", { hasText: reason })).toContainText("Pending");

    await adminLogin(page);
    const item = page.locator("li", { hasText: reason });
    await expect(item).toContainText("Leave");
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved")).toBeVisible();
    await expect(page.locator("li", { hasText: reason })).toContainText("Approved");

    await e.reload();
    await expect(e.locator("li", { hasText: reason })).toContainText("Approved");
    await employee.close();
  });

  test("balances need a signed-in identity, not just a device", async ({ page }) => {
    await page.goto("/away");
    const balance = page.locator("[data-slot=card]").filter({ hasText: "Leave balance" });
    await expect(balance).toContainText("Sign in");
    await expect(balance.getByRole("link", { name: "Full tracker" })).toBeVisible();
  });

  test("a leave request moves from pending to used in the signed-in tracker", async ({ page, browser }) => {
    const reason = uniqueText("balance check");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    // Sign in so there's an entitlement to draw from, then book 2 working days.
    await e.goto("/api/auth/google?next=/away");
    await e.locator("#away-leave-type").selectOption("cl");
    await e.locator("#away-start").fill("2026-09-07"); // Mon
    await e.locator("#away-end").fill("2026-09-08"); // Tue
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();

    await e.goto("/leave");
    const casual = e.locator("li", { hasText: "Casual Leave" });
    await expect(casual).toContainText("2 pending");
    await expect(casual).toContainText("of 4 left"); // current policy entitlement

    await adminLogin(page);
    await page.locator("li", { hasText: reason }).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved")).toBeVisible();
    // The admin overview lists everyone's remaining days per type.
    await expect(page.locator("#leave")).toContainText("Leave balances");

    await e.goto("/leave");
    await expect(e.locator("li", { hasText: "Casual Leave" })).toContainText("2 of 4 left");
    await employee.close();
  });

  test("the tracker shows the holiday calendar and the weekly-off rule", async ({ page }) => {
    await page.goto("/api/auth/google?next=/leave");
    await expect(page.getByRole("heading", { level: 1, name: "Leave tracker" })).toBeVisible();
    await expect(page.getByText(/2nd and 4th Saturday are weekly offs/)).toBeVisible();
    const holidays = page.locator("[data-slot=card]").filter({ hasText: "Holidays" });
    await expect(holidays).toContainText("Republic Day");
    await expect(holidays).toContainText("Onam");
  });

  test("a non-working day is refused with the reason", async ({ page }) => {
    await page.goto("/away");
    await page.locator("#away-start").fill("2026-09-06"); // a Sunday
    await page.locator("#away-end").fill("2026-09-06");
    await page.getByLabel("Your Innovin email").fill(uniqueEmail("sun"));
    await page.getByRole("button", { name: "Request Leave" }).click();
    await expect(page.getByText(/non-working day \(Sunday\)/)).toBeVisible();
  });

  test("half-day Casual Leave costs half a day", async ({ page }) => {
    const reason = uniqueText("half day");
    await page.goto("/api/auth/google?next=/away");
    await page.locator("#away-leave-type").selectOption("cl");
    await page.getByLabel(/Half day/).check();
    await page.locator("#away-start").fill("2026-09-09");
    await page.locator("#away-end").fill("2026-09-09");
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Request Leave" }).click();
    await expect(page.getByText("Leave request sent")).toBeVisible();

    await page.goto("/leave");
    await expect(page.locator("li", { hasText: "Casual Leave" })).toContainText("0.5 pending");
  });
});
