import { adminLogin, adminTab, expect, test, typePin, uniqueEmail, uniqueText, signInOffice, signInEmployee } from "./fixtures";

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
    for (const stat of ["Checked in today", "Pantry requests", "Open reports", "Poor Wi-Fi reports today"]) {
      await expect(page.getByText(stat,{exact:true})).toBeVisible();
    }
  });

  test("sees employee activity: attendance and consolidated orders with instructions", async ({ page, browser }) => {
    const email = uniqueEmail("ops");
    const instructions = uniqueText("extra hot");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await signInOffice(e, email);
    await e.goto("/snacks");
    await e.getByRole("button", { name: /^Tea/ }).click();
    await e.getByLabel("Special instructions").fill(instructions);
    await e.getByRole("button", { name: "Save request notes" }).click();
    await expect(e.getByText("Your pantry request is saved")).toBeVisible();
    await employee.close();

    await adminLogin(page);
    await expect(page.locator("#orders").getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByText(`Tea: ${instructions}`)).toBeVisible();
  });

  test("groups sections into tabs, badges pending work, and stats jump to their section", async ({ page, browser }) => {
    // A pending request so the Approvals badge has something to count.
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await signInEmployee(e);
    await e.getByRole("tab", { name: "Leave" }).click();
    await e.locator("#away-start").fill("2026-10-19");
    await e.locator("#away-end").fill("2026-10-19");
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();
    await employee.close();

    await adminLogin(page);
    // Today is the default: orders and attendance are here, the rest is not.
    await expect(page.locator("#orders")).toBeVisible();
    await expect(page.locator("#away")).toBeHidden();
    await expect(page.locator("#announcements")).toBeHidden();

    // The Approvals tab carries a count so nothing waits unseen.
    const approvals = page.getByRole("link", { name: /^Approvals/ });
    await expect(approvals).toContainText(/[1-9]/);

    // A stat tile is navigation: it opens the tab that can act on the number.
    await page.getByRole("link", { name: /Open reports/ }).click();
    await expect(page).toHaveURL(/tab=approvals/);
    await expect(page.locator("#grievances")).toBeVisible();
    await expect(page.locator("#away")).toBeVisible();
    await expect(page.locator("#orders")).toBeHidden();

    await adminTab(page, "people");
    await expect(page.locator("#leave")).toBeVisible();
    // Balances are copied from Zoho, so the section says so rather than implying it's the record.
    await expect(page.locator("#leave")).toContainText("Zoho People holds the real balances");

    await adminTab(page, "publish");
    await expect(page.locator("#events")).toBeVisible();
    await expect(page.locator("#announcements")).toBeVisible();
  });

  test("grievance lifecycle: employee submits → admin resolves → employee sees Resolved", async ({ page, browser }) => {
    const text = uniqueText("AC not working in meeting room");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/grievances");
    await e.getByLabel("Your feedback").fill(text);
    await e.getByRole("button", { name: "Submit" }).click();
    await expect(e.locator("#mine li", { hasText: text })).toContainText("Open");

    await adminLogin(page, "approvals");
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
    await employee.close();
  });

  test("announcements: post → visible to employees → delete with confirmation", async ({ page, browser, isMobile }) => {
    const title = uniqueText("Fire drill at 3 PM");
    await adminLogin(page, "publish");
    // The composer renders one form at a time, so these no longer need scoping to disambiguate
    // them from the event form.
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Tag").fill("Safety");
    await page.getByLabel("Details").fill("Assemble at the parking lot.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByText("Announcement posted")).toBeVisible();
    await expect(page).not.toHaveURL(/done=/);
    await expect(page.getByText(title)).toBeVisible();

    const employee = await browser.newContext();
    const e = await employee.newPage();
    await signInOffice(e);
    if (isMobile) await e.getByRole("button", { name: "Office Notice Board", exact: true }).click();
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
    if (isMobile) await e.getByRole("button", { name: "Office Notice Board", exact: true }).click();
    await expect(e.getByText(title)).toHaveCount(0);
    await employee.close();
  });

  test("session persists across reloads and sign out locks the dashboard", async ({ page }) => {
    await adminLogin(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "End passcode access" }).click();
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
