import { ADMIN_EMAIL, expect, signInEmployee, test, uniqueEmail } from "./fixtures";

test("member workflows stay on Home, persist across reload, and deny admin tools", async ({ page }) => {
  await signInEmployee(page, uniqueEmail("workspace-member"));
  const workspace = page.getByRole("navigation", { name: "Workspace" });
  await workspace.getByRole("link", { name: "10K steps" }).click();
  await expect(page).toHaveURL(/\/?\?view=steps$/);
  await page.getByRole("textbox", { name: "Add steps from your phone's step counter" }).fill("2500");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2,500 / 10,000" })).toBeVisible();
  await workspace.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("link", { name: "10K steps: 2,500 today" })).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(page.getByRole("heading", { name: "2,500 / 10,000" })).toBeVisible();
  await page.goto("/?view=admin-people");
  await expect(page.getByRole("region", { name: "Admin tools" })).toHaveCount(0);
  await expect(workspace.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
});

test("an admin can open Calendar in Home and OAuth returns to the same panel", async ({ page }) => {
  await signInEmployee(page, ADMIN_EMAIL);
  await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Admin", exact: true }).click();
  const admin = page.getByRole("navigation", { name: "Admin tools" });
  await admin.getByRole("link", { name: "Publish" }).click();
  await page.getByRole("tab", { name: "Events" }).click();
  await expect(page).toHaveURL(/[?&]view=admin-publish/);
  const calendar = page.getByRole("region", { name: "Google Calendar" });
  await calendar.getByRole("link", { name: "Connect Google Calendar" }).click();
  await expect(page).toHaveURL(/[?&]view=admin-publish/);
  await expect(calendar.getByText(/Invites go out from/)).toBeVisible();
  await calendar.getByRole("button", { name: "Disconnect" }).click();
  await calendar.getByRole("group", { name: "Confirm disconnect" }).getByRole("button", { name: "Disconnect" }).click();
  await expect(calendar.getByRole("link", { name: "Connect Google Calendar" })).toBeVisible();
});
