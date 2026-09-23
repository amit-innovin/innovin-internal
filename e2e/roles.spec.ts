import { expect, test, typePin } from "./fixtures";
import type { Browser, Page } from "@playwright/test";

// Roles: owner (bootstrapped from OWNER_EMAILS) > admin (granted by the owner) > member.
// The shared ADMIN_PASSCODE stays as break-glass and carries no identity.
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
  test("a bootstrap owner gets the dashboard by identity, with the owner-only Access card", async ({ browser }) => {
    const { ctx, page } = await signInAs(browser, "owner@innovinlabs.com", "Owner E2E");

    // No passcode typed — the dashboard opens because the directory role says owner.
    await page.goto("/admin?tab=people");
    await expect(dashboard(page)).toBeVisible();
    await expect(page.getByText(/· Owner E2E/)).toBeVisible(); // attributed in the header, not "shared passcode"
    await expect(page.locator("#access")).toBeVisible();
    await ctx.close();
  });

  test("a member gets no dashboard until the owner grants admin, and never sees Access", async ({ browser }) => {
    const email = `member.${Date.now().toString(36)}@innovinlabs.com`;
    const member = await signInAs(browser, email, "Member E2E");

    // Signed in, but still a member: /admin stays locked behind the passcode screen.
    await member.page.goto("/admin");
    await expect(dashboard(member.page)).toBeHidden();
    await expect(member.page.getByLabel("Admin passcode")).toBeVisible();

    // The owner grants admin from the Access card.
    const owner = await signInAs(browser, "owner@innovinlabs.com", "Owner E2E");
    await owner.page.goto("/admin?tab=people");
    const row = owner.page.locator("#access li", { hasText: email });
    await row.getByRole("button", { name: "Make admin" }).click();
    await expect(row.getByRole("button", { name: "Revoke admin" })).toBeVisible();

    // The member now has the dashboard — but not the owner-only Access card.
    await member.page.goto("/admin");
    await expect(dashboard(member.page)).toBeVisible();
    await expect(member.page.locator("#access")).toHaveCount(0);

    // Revoking takes it away again.
    await owner.page.goto("/admin?tab=people");
    await owner.page.locator("#access li", { hasText: email }).getByRole("button", { name: "Revoke admin" }).click();
    await expect(owner.page.getByText("Admin access revoked")).toBeVisible();
    await member.page.goto("/admin");
    await expect(dashboard(member.page)).toBeHidden();

    await member.ctx.close();
    await owner.ctx.close();
  });

  test("approvals are attributed to the admin who made them", async ({ browser, page }) => {
    // An employee files a leave request.
    const reason = `attribution ${Date.now().toString(36)}`;
    await page.goto("/attendance");
    await page.getByRole("tab", { name: "Leave" }).click();
    await page.locator("#away-start").fill("2026-11-02");
    await page.locator("#away-end").fill("2026-11-03");
    await page.getByLabel("Email for this request").fill(`att.${Date.now().toString(36)}@innovinlabs.com`);
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Request leave" }).click();
    await expect(page.locator("li", { hasText: reason })).toContainText("Pending");

    const owner = await signInAs(browser, "owner@innovinlabs.com", "Owner E2E");
    await owner.page.goto("/admin?tab=approvals");
    const request = owner.page.locator("li", { hasText: reason });
    await request.getByRole("button", { name: "Approve" }).click();
    await expect(request).toContainText("Approved by Owner E2E");
    await owner.ctx.close();
  });

  test("only the owner can change roles, and the owner's own role is immutable", async ({ browser }) => {
    const email = `nonowner.${Date.now().toString(36)}@innovinlabs.com`;
    const { ctx, page } = await signInAs(browser, email, "Not Owner");

    // A plain member can't grant themselves admin.
    const attempt = await page.request.patch("/api/people", { data: { email, role: "admin" } });
    expect(attempt.status()).toBe(401);
    await ctx.close();

    const owner = await signInAs(browser, "owner@innovinlabs.com", "Owner E2E");
    // Even the owner can't demote an owner — that's OWNER_EMAILS' job.
    const demote = await owner.page.request.patch("/api/people", {
      data: { email: "owner@innovinlabs.com", role: "member" },
    });
    expect(demote.status()).toBe(403);
    // Unknown people and bad roles are rejected cleanly.
    expect((await owner.page.request.patch("/api/people", { data: { email: "ghost@innovinlabs.com", role: "admin" } })).status()).toBe(404);
    expect((await owner.page.request.patch("/api/people", { data: { email, role: "owner" } })).status()).toBe(400);
    await owner.ctx.close();
  });

  test("the Admin link appears in the nav only for admins, and works on both navs", async ({ browser }) => {
    const email = `nav.${Date.now().toString(36)}@innovinlabs.com`;

    // An unsigned visitor gets no Admin entry anywhere.
    const visitor = await browser.newContext();
    const v = await visitor.newPage();
    await v.goto("/");
    await expect(v.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
    await visitor.close();

    // A signed-in member still gets none — the nav must know the role, not just sign-in state.
    const member = await signInAs(browser, email, "Member E2E");
    await member.page.goto("/");
    await expect(member.page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

    // Once the owner grants admin, the same person's nav gains it on the very next page load.
    const owner = await signInAs(browser, "owner@innovinlabs.com", "Owner E2E");
    await owner.page.goto("/admin?tab=people");
    await owner.page.locator("#access li", { hasText: email }).getByRole("button", { name: "Make admin" }).click();
    await expect(owner.page.getByText("Admin access granted")).toBeVisible();
    await owner.ctx.close();

    await member.page.goto("/");
    const link = member.page.getByRole("link", { name: "Admin", exact: true }).filter({ visible: true });
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(dashboard(member.page)).toBeVisible();
    await member.ctx.close();
  });

  test("admins get the Admin entry in the mobile top bar too", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/admin");
    // PIN sign-in — the break-glass path should get the link as well.
    await typePin(page, "1704");
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();

    await page.goto("/");
    const link = page.getByRole("link", { name: "Admin", exact: true }).filter({ visible: true });
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await ctx.close();
  });
});
