import type { Browser } from "@playwright/test";
import { ADMIN_EMAIL, expect, isMobile, signInEmployee, test } from "./fixtures";

// Roles: admin and member. ADMIN_EMAILS (playwright.config: admin@innovinlabs.com) bootstraps
// admins, who can't be demoted in-app; any admin promotes or demotes other members, from the
// admin app's People panel.
async function signInAs(browser: Browser, email: string, next = "/") {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signInEmployee(page, email, next);
  return { ctx, page };
}
const todayHeading = (page: import("@playwright/test").Page) => page.getByRole("heading", { level: 1, name: "Today" });
const firstName = (email: string) => email.split("@")[0].split(".")[0].replace(/^./, (c) => c.toUpperCase());

async function setAdmin(browser: Browser, email: string, on: boolean) {
  const admin = await signInAs(browser, ADMIN_EMAIL, `/admin/people?person=${encodeURIComponent(email)}`);
  const panel = admin.page.getByRole("region", { name: firstName(email) });
  const toggle = panel.getByRole("switch", { name: "Admin" });
  await expect(toggle).toHaveAttribute("aria-checked", on ? "false" : "true");
  await toggle.click();
  await expect(admin.page.getByText(on ? "Made an admin" : "Admin removed")).toBeVisible();
  await admin.ctx.close();
}

test.describe("Roles & access", () => {
  test("a bootstrap admin opens the admin app, and can't be demoted", async ({ browser }) => {
    const { ctx, page } = await signInAs(browser, ADMIN_EMAIL, "/admin");
    await expect(todayHeading(page)).toBeVisible();
    expect((await page.request.patch("/api/people", { data: { email: ADMIN_EMAIL, role: "member" } })).status()).toBe(403);
    await ctx.close();
  });

  test("a member is kept off the admin app until granted, and loses it when revoked", async ({ browser }) => {
    const email = `member.${Date.now().toString(36)}@innovinlabs.com`;
    const member = await signInAs(browser, email);
    await member.page.goto("/admin");
    await expect(member.page).toHaveURL(/\/$/);
    await expect(todayHeading(member.page)).toHaveCount(0);

    await setAdmin(browser, email, true);
    await member.page.goto("/admin"); // takes effect on the very next request
    await expect(todayHeading(member.page)).toBeVisible();

    await setAdmin(browser, email, false);
    await member.page.goto("/admin");
    await expect(member.page).toHaveURL(/\/$/);
    await member.ctx.close();
  });

  test("role changes: members can't, env admins and yourself are locked, bad input is rejected", async ({ browser }) => {
    const email = `nonadmin.${Date.now().toString(36)}@innovinlabs.com`;
    const { ctx, page } = await signInAs(browser, email);
    expect((await page.request.patch("/api/people", { data: { email, role: "admin" } })).status()).toBe(401);
    await ctx.close();
    const admin = await signInAs(browser, ADMIN_EMAIL, "/admin");
    expect((await admin.page.request.patch("/api/people", { data: { email: ADMIN_EMAIL, role: "member" } })).status()).toBe(403);
    expect((await admin.page.request.patch("/api/people", { data: { email: "ghost@innovinlabs.com", role: "admin" } })).status()).toBe(404);
    expect((await admin.page.request.patch("/api/people", { data: { email, role: "owner" } })).status()).toBe(400);
    await admin.ctx.close();
  });

  test("the Admin app entry appears only for admins, and works", async ({ browser }) => {
    const email = `nav.${Date.now().toString(36)}@innovinlabs.com`;
    const member = await signInAs(browser, email);
    // Laptops: "Admin app" in the sidebar. Phones: "Admin" on the Account page.
    const entry = async () => {
      if (isMobile(member.page)) { await member.page.goto("/account"); return member.page.getByRole("link", { name: /^Admin/ }); }
      await member.page.goto("/");
      return member.page.getByRole("link", { name: /^Admin app/ }).filter({ visible: true });
    };
    await expect(await entry()).toHaveCount(0);
    await setAdmin(browser, email, true);
    const link = await entry();
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(todayHeading(member.page)).toBeVisible();
    await member.ctx.close();
  });
});
