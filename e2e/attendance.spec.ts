import { checkIn, expect, test, uniqueEmail } from "./fixtures";

test.describe("Attendance", () => {
  test("rejects a non-Innovin email inline, then clears the error when the email changes", async ({ page }) => {
    await page.goto("/attendance");
    const email = page.getByPlaceholder("you@innovinlabs.com");
    await email.fill("someone@gmail.com");
    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByText("Use your Innovin email")).toBeVisible();
    await email.fill(uniqueEmail());
    await expect(page.getByText("Use your Innovin email")).toBeHidden();
  });

  test("blocks submission of a malformed email in the browser", async ({ page }) => {
    await page.goto("/attendance");
    await page.getByPlaceholder("you@innovinlabs.com").fill("not-an-email");
    await page.getByRole("button", { name: "Check In" }).click();
    expect(await page.getByPlaceholder("you@innovinlabs.com").evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page.getByRole("heading", { name: "Not checked in yet" })).toBeVisible();
  });

  test("full day: check in, remembered on reload, check out, done state, reflected on home", async ({ page }) => {
    const email = uniqueEmail("amit");
    await checkIn(page, email);
    await expect(page.getByText("Office • Innovin")).toBeVisible();
    await expect(page.getByText(/person|people/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();

    await page.getByRole("button", { name: "Check Out" }).click();
    await expect(page.getByRole("heading", { name: "You're checked out" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Done for today/ })).toBeDisabled();

    await page.goto("/");
    await expect(page.getByText("Checked out")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(", Amit");
  });

  test("a remembered email offers one-tap check-in and 'Not you?' switches user", async ({ page, context, baseURL }) => {
    // Simulate an email remembered from a previous day (not checked in today).
    const email = uniqueEmail("returning");
    await context.addCookies([{ name: "innovin_email", value: email, url: baseURL! }]);
    await page.goto("/attendance");
    await expect(page.getByText(`Checking in as ${email}`)).toBeVisible();
    await expect(page.getByPlaceholder("you@innovinlabs.com")).toHaveCount(0);
    await page.getByRole("button", { name: "Not you?" }).click();
    await expect(page.getByPlaceholder("you@innovinlabs.com")).toBeVisible();

    await context.addCookies([{ name: "innovin_email", value: email, url: baseURL! }]);
    await page.reload();
    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();
  });

  test("Settings 'Forget me' clears the remembered email after confirmation", async ({ page }) => {
    const email = uniqueEmail();
    await checkIn(page, email);
    await page.goto("/settings");
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole("button", { name: "Forget me on this device" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Forget me" }).click();
    await expect(page.getByText("No email saved on this device")).toBeVisible();
    await page.goto("/attendance");
    await expect(page.getByPlaceholder("you@innovinlabs.com")).toBeVisible();
  });
});
