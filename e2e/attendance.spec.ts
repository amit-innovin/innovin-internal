import { checkIn, expect, test, uniqueEmail, signInEmployee } from "./fixtures";

test.describe("Attendance", () => {
  test("guest attendance requires Google identity rather than a typed email", async ({ page }) => {
    await page.goto("/attendance");
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByPlaceholder("you@innovinlabs.com")).toHaveCount(0);
    expect((await page.request.post("/api/attendance", { data: { email: uniqueEmail(), action: "in" } })).status()).toBe(401);
  });

  test("Google rejects a non-company account before attendance access", async ({ page }) => {
    await signInEmployee(page, "someone@gmail.com", "/sign-in?auth=failed");
    await expect(page.getByText("Sign-in didn't complete. Use your Innovin Google account.")).toBeVisible();
    expect((await page.request.get("/api/attendance")).status()).toBe(401);
  });

  test("full day: check in, check out, check in again — one status, no time tracking", async ({ page }) => {
    const email = uniqueEmail("amit");
    await checkIn(page, email);
    await expect(page.getByText("Location not shared • Innovin")).toBeVisible();
    await expect(page.getByText(/person|people/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();

    await page.getByRole("button", { name: "Check Out" }).click();
    await expect(page.getByRole("heading", { name: "You're checked out" })).toBeVisible();
    await expect(page.getByText(/Out since/)).toBeVisible();

    // Stepped out and back — you're simply in again, no second session.
    await page.getByRole("button", { name: "Check In Again" }).click();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();
    await expect(page.getByText(/In since/)).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your workspace" })).toBeVisible();
    expect((await (await page.request.get("/api/attendance")).json()).me.checkedIn).toBe(true);
  });

  test("check-in inside the office radius tags the session In office", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.9352, longitude: 77.6241, accuracy: 15 });
    await checkIn(page, uniqueEmail("office"));
    await expect(page.getByText("In office • Innovin")).toBeVisible();
  });

  test("check-in far from the office tags the session Remote", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 13.05, longitude: 77.6, accuracy: 20 });
    await checkIn(page, uniqueEmail("remote"));
    await expect(page.getByText("Remote • Innovin")).toBeVisible();
  });

  test("a remembered email cannot impersonate an employee and Not you signs out", async ({ page, context, baseURL }) => {
    const email = uniqueEmail("returning");
    await context.addCookies([{ name: "innovin_email", value: email, url: baseURL! }]);
    await page.goto("/attendance");
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    expect((await page.request.get("/api/attendance")).status()).toBe(401);
    await signInEmployee(page, email);
    await expect(page.getByText(/Checking in as/)).toContainText(email);
    await page.getByRole("button", { name: "Not you?" }).click();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    expect((await page.request.get("/api/attendance")).status()).toBe(401);
  });

  test("Settings sign-out removes attendance access", async ({ page }) => {
    await checkIn(page, uniqueEmail());
    await page.goto("/settings");
    await expect(page.getByText("Verified with Google")).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByText("Verified with Google")).toBeHidden();
    await page.goto("/attendance");
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
  });
});
