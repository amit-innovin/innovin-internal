import { ADMIN_EMAIL, expect, signInEmployee, test } from "./fixtures";
import type { Browser, Page } from "@playwright/test";

// Roles: admin and member. ADMIN_EMAILS (playwright.config: admin@innovinlabs.com) bootstraps
// admins, who can't be demoted in-app; any admin promotes or demotes other members.
const MOCK = "http://localhost:3999";

// Pins who the Google mock signs in as, then completes the round-trip in a fresh context.
async function signInAs(browser: Browser, email: string, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.request.get(`${MOCK}/as?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
  await page.goto("/api/auth/google?next=/settings");
  await expect(page.getByText("Verified with Google")).toBeVisible();
  await page.request.get(`${MOCK}/as?reset=1`);
  return { ctx, page };
}

const dashboard = (page: Page) => page.getByRole("heading", { name: "Admin dashboard" });

test.describe("Roles & access", () => {
  test("a bootstrap admin gets the dashboard by identity, attributed by name", async ({ browser }) => {
    const { ctx, page } = await signInAs(browser, ADMIN_EMAIL, "Admin E2E");
    await page.goto("/admin?tab=people");
    await expect(dashboard(page)).toBeVisible();
    await expect(page.getByText(/· Admin E2E/)).toBeVisible();
    // Their own row is marked as set in ADMIN_EMAILS, never offered a button.
    await expect(page.locator("#access li", { hasText: ADMIN_EMAIL })).toContainText("Set in ADMIN_EMAILS");
    await ctx.close();
  });

  test("a member is kept off /admin until an admin grants it, and loses it when revoked", async ({ browser }) => {
    const email = `member.${Date.now().toString(36)}@innovinlabs.com`;
    const member = await signInAs(browser, email, "Member E2E");

    await member.page.goto("/admin");
    await expect(member.page).toHaveURL(/\/$/);
    await expect(dashboard(member.page)).toHaveCount(0);

    const admin = await signInAs(browser, ADMIN_EMAIL, "Admin E2E");
    await admin.page.goto("/admin?tab=people");
    const row = admin.page.locator("#access li", { hasText: email });
    await row.getByRole("button", { name: "Make admin" }).click();
    await expect(row.getByRole("button", { name: "Revoke admin" })).toBeVisible();

    // Promoted on the very next request — and as an admin they see Access too.
    await member.page.goto("/admin?tab=people");
    await expect(dashboard(member.page)).toBeVisible();
    await expect(member.page.locator("#access li", { hasText: email })).toContainText("You");

    await admin.page.goto("/admin?tab=people");
    await admin.page.locator("#access li", { hasText: email }).getByRole("button", { name: "Revoke admin" }).click();
    await expect(admin.page.getByText("Admin access revoked")).toBeVisible();
    await member.page.goto("/admin");
    await expect(member.page).toHaveURL(/\/$/);

    await member.ctx.close();
    await admin.ctx.close();
  });

  test("approvals are attributed to the admin who made them", async ({ browser, page }) => {
    const reason = `attribution ${Date.now().toString(36)}`;
    await signInEmployee(page);
    await page.getByRole("tab", { name: "Leave" }).click();
    await page.locator("#away-start").fill("2026-11-02");
    await page.locator("#away-end").fill("2026-11-03");
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Request leave" }).click();
    await expect(page.locator("li", { hasText: reason })).toContainText("Pending");

    const admin = await signInAs(browser, ADMIN_EMAIL, "Admin E2E");
    await admin.page.goto("/admin?tab=approvals");
    const request = admin.page.locator("li", { hasText: reason });
    await request.getByRole("button", { name: "Approve" }).click();
    await expect(request).toContainText("Approved by Admin E2E");
    await admin.ctx.close();
  });

  test("role changes: members can't, env admins and yourself are locked, bad input is rejected", async ({ browser }) => {
    const email = `nonadmin.${Date.now().toString(36)}@innovinlabs.com`;
    const { ctx, page } = await signInAs(browser, email, "Not Admin");
    expect((await page.request.patch("/api/people", { data: { email, role: "admin" } })).status()).toBe(401);
    await ctx.close();

    const admin = await signInAs(browser, ADMIN_EMAIL, "Admin E2E");
    const demote = await admin.page.request.patch("/api/people", { data: { email: ADMIN_EMAIL, role: "member" } });
    expect(demote.status()).toBe(403);
    expect((await admin.page.request.patch("/api/people", { data: { email: "ghost@innovinlabs.com", role: "admin" } })).status()).toBe(404);
    expect((await admin.page.request.patch("/api/people", { data: { email, role: "owner" } })).status()).toBe(400);
    await admin.ctx.close();
  });

  test("the Admin link appears in the nav only for admins, and works", async ({ browser }) => {
    const email = `nav.${Date.now().toString(36)}@innovinlabs.com`;
    const member = await signInAs(browser, email, "Member E2E");
    await member.page.goto("/");
    await expect(member.page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

    const admin = await signInAs(browser, ADMIN_EMAIL, "Admin E2E");
    await admin.page.goto("/admin?tab=people");
    await admin.page.locator("#access li", { hasText: email }).getByRole("button", { name: "Make admin" }).click();
    await expect(admin.page.getByText("Admin access granted")).toBeVisible();
    await admin.ctx.close();

    await member.page.goto("/");
    if (!(await member.page.getByRole("link", { name: "Admin", exact: true }).filter({ visible: true }).count())) {
      await member.page.locator(".reference-more summary").click();
    }
    const link = member.page.getByRole("link", { name: "Admin", exact: true }).filter({ visible: true });
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(dashboard(member.page)).toBeVisible();
    await member.ctx.close();
  });
});
