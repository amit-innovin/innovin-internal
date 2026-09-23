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

  test("the leave balance counts pending days, then used days once approved", async ({ page, browser }) => {
    const year = new Date().getFullYear();
    const reason = uniqueText("balance check");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/away");
    await e.locator("#away-start").fill(`${year}-11-10`);
    await e.locator("#away-end").fill(`${year}-11-12`);
    await e.getByLabel("Your Innovin email").fill(uniqueEmail("bal"));
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();

    const balance = e.locator("[data-slot=card]").filter({ hasText: "Leave balance" });
    await expect.poll(async () => balance.innerText()).toMatch(/0\s+used\s+3\s+pending\s+12\s+of 12 left/);

    await adminLogin(page);
    await page.locator("li", { hasText: reason }).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved")).toBeVisible();

    // Admin sees the per-person usage line under Time away.
    await expect(page.getByText(`Leave balance · ${year} · 12 days each`)).toBeVisible();

    await e.reload();
    await expect.poll(async () => balance.innerText()).toMatch(/3\s+used\s+0\s+pending\s+9\s+of 12 left/);
    await employee.close();
  });
});
