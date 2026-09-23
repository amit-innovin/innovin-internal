import { adminLogin, expect, test, typePin, uniqueEmail, uniqueText } from "./fixtures";

test.describe("Admin", () => {
  test("wrong PIN is rejected with feedback; correct PIN opens the dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Enter the admin passcode")).toBeVisible();
    await typePin(page, "0000");
    await expect(page.getByText("Wrong passcode — try again")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toHaveCount(0);

    await page.reload();
    await typePin(page, "1704");
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    for (const stat of ["Checked in today", "Orders today", "Open grievances", "Poor Wi-Fi reports today"]) {
      await expect(page.getByText(stat)).toBeVisible();
    }
  });

  test("sees employee activity: attendance and consolidated orders with instructions", async ({ page, browser }) => {
    const email = uniqueEmail("ops");
    const instructions = uniqueText("extra hot");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/attendance");
    await e.getByPlaceholder("you@innovinlabs.com").fill(email);
    await e.getByRole("button", { name: "Check In" }).click();
    await expect(e.getByRole("heading", { name: "You're checked in" })).toBeVisible();
    await e.goto("/snacks");
    await e.getByRole("button", { name: /^Tea/ }).click();
    await e.getByLabel("Special instructions").fill(instructions);
    await e.getByRole("button", { name: "Submit Order" }).click();
    await expect(e.getByText("Order placed: Tea")).toBeVisible();
    await employee.close();

    await adminLogin(page);
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText(`Tea: ${instructions}`)).toBeVisible();
  });

  test("grievance lifecycle: employee submits → admin resolves → employee sees Resolved", async ({ page, browser }) => {
    const text = uniqueText("AC not working in meeting room");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/grievances");
    await e.getByLabel("Your feedback").fill(text);
    await e.getByRole("button", { name: "Submit" }).click();
    await expect(e.locator("#mine li", { hasText: text })).toContainText("Open");

    await adminLogin(page);
    const item = page.locator("li", { hasText: text });
    await expect(item).toContainText("Anonymous");
    await item.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "In progress" }).click();
    await expect(page.getByText("Marked as in progress")).toBeVisible();
    await item.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Resolved" }).click();
    await expect(page.getByText("Marked as resolved")).toBeVisible();
    await page.reload();
    await expect(page.locator("li", { hasText: text })).toContainText("Resolved");

    await e.reload();
    await expect(e.locator("#mine li", { hasText: text })).toContainText("Resolved");
    await e.goto("/");
    await expect(e.locator("li", { hasText: text })).toContainText("Resolved");
    await employee.close();
  });

  test("announcements: post → visible to employees → delete with confirmation", async ({ page, browser }) => {
    const title = uniqueText("Fire drill at 3 PM");
    await adminLogin(page);
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="tag"]').fill("Safety");
    await page.locator('textarea[name="body"]').fill("Assemble at the parking lot.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByText("Announcement posted")).toBeVisible();
    await expect(page).not.toHaveURL(/done=/);
    await expect(page.getByText(title)).toBeVisible();

    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/");
    await expect(e.getByText(title)).toBeVisible();
    await expect(e.getByText("Assemble at the parking lot.")).toBeVisible();

    const listed = page.locator("#announcements li", { hasText: title });
    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await expect(page.getByRole("alertdialog")).toContainText(title);
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(listed).toBeVisible();
    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Announcement deleted")).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(listed).toHaveCount(0);

    await e.reload();
    await expect(e.getByText(title)).toHaveCount(0);
    await employee.close();
  });

  test("session persists across reloads and sign out locks the dashboard", async ({ page }) => {
    await adminLogin(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText("Enter the admin passcode")).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByText("Enter the admin passcode")).toBeVisible();
  });

  test("a tampered session cookie is rejected", async ({ page, context }) => {
    await adminLogin(page);
    const cookie = (await context.cookies()).find((c) => c.name === "innovin_admin")!;
    await context.addCookies([{ ...cookie, value: cookie.value.replace(/.$/, (ch) => (ch === "a" ? "b" : "a")) }]);
    await page.reload();
    await expect(page.getByText("Enter the admin passcode")).toBeVisible();
  });
});
