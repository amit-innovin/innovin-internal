import { ADMIN_EMAIL, expect, test, uniqueEmail, signInEmployee } from "./fixtures";

// Account: profile, then Settings, Help & privacy, Admin (admins only) and Sign out.
test.describe("Account", () => {
  test("a member sees Notification settings, Help and Sign out, and signing out works", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("account-member"), "/account");
    const list = page.getByRole("main");
    await expect(list.locator(".m3-row")).toHaveText([/^Notification settings/, /^Usual office days/, /^Help/, /^Speak up/]);
    await list.getByRole("button", { name: /^Notification settings/ }).click();
    await expect(page.getByRole("dialog", { name: "Notification settings" })).toContainText("Grievance updates are never sent as notifications.");
    await page.keyboard.press("Escape");
    await list.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("an admin also gets one Admin row", async ({ page }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/account");
    await expect(page.getByRole("link", { name: /^Admin.*Opens the admin app/ })).toHaveAttribute("href", "/admin");
  });
});
