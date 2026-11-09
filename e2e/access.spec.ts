import { expect, signInEmployee, test, uniqueEmail } from "./fixtures";

// Two roles. Signed-out visitors see only sign-in (and anonymous Speak Up); members never see
// an admin page or a passcode prompt. ADMIN_EMAILS (playwright.config) lists admin@innovinlabs.com.
test.describe("Access", () => {
  for (const path of ["/", "/admin", "/pantry", "/attendance?tab=leave"]) {
    test(`a signed-out visit to ${path} lands on sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in\?next=/);
      await expect(page.getByRole("link", { name: /Continue with Google/ })).toBeVisible();
    });
  }

  test("anonymous Speak Up stays open without signing in, with no workspace navigation", async ({ page }) => {
    await page.goto("/grievances");
    await expect(page.getByRole("heading", { name: "Speak Up" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(page.getByText("More", { exact: true })).toHaveCount(0);
  });

  test("a member is sent home from admin pages and never sees a passcode prompt", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("member"), "/");
    for (const path of ["/admin", "/admin?tab=people", "/admin/pantry"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByText(/passcode/i)).toHaveCount(0);
    }
  });

  test("the ID pass and settings reflect the real role", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("member"), "/");
    await expect(page.locator(".pill-level").first()).toHaveText("MEMBER");
    await page.goto("/settings");
    await expect(page.getByText("Admin dashboard")).toHaveCount(0);

    const ctx = await browser.newContext();
    const admin = await ctx.newPage();
    await signInEmployee(admin, "admin@innovinlabs.com", "/");
    await expect(admin.locator(".pill-level").first()).toHaveText("ADMIN");
    await admin.goto("/settings");
    await expect(admin.getByText("Admin dashboard")).toBeVisible();
    await admin.goto("/admin");
    await expect(admin.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await ctx.close();
  });
});
