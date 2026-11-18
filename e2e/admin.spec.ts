import { futureWorkday } from "./dates";
import { ADMIN_EMAIL, expect, test, signInEmployee } from "./fixtures";

// The admin app's session: it's the Google sign-in, nothing separate.
test.describe("Admin session", () => {
  test("persists across reloads, and signing out locks the admin app", async ({ page }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await page.request.post("/api/auth/logout");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin/);
  });

  test("a tampered session cookie is rejected", async ({ page, context }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    const cookie = (await context.cookies()).find((c) => c.name === "innovin_user")!;
    await context.addCookies([{ ...cookie, value: cookie.value.replace(/.$/, (ch) => (ch === "a" ? "b" : "a")) }]);
    await page.reload();
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });
});

test.describe("Admin: closed days and today", () => {
  test("close the office on a date with a reason, see it listed, and reopen it", async ({ page }) => {
    const date = futureWorkday(5);
    await signInEmployee(page, ADMIN_EMAIL, "/admin/office");
    await expect(page.getByRole("button", { name: "Mark closed" })).toBeDisabled();
    await page.getByLabel("Date").fill(date);
    await page.getByLabel("Reason").fill("Building maintenance");
    await page.getByRole("button", { name: "Mark closed" }).click();
    const closed = page.getByRole("region", { name: "Upcoming closed days" });
    await expect(closed).toContainText("Building maintenance");
    await closed.getByRole("button", { name: new RegExp(`^Remove .*${Number(date.slice(8))}`) }).click();
    await expect(closed).not.toContainText("Building maintenance");
  });

  test("today names who's in and who's on leave: no remote, no counts", async ({ page }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    const today = page.getByRole("region", { name: "Today in the office" });
    await expect(today).toContainText("In office");
    await expect(today).toContainText("On leave");
    await expect(today).not.toContainText(/remote|Not in office/i);
  });
});
