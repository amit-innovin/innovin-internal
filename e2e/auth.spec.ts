import { expect, test } from "./fixtures";

// Full sign-in round-trip against the Google OAuth mock (e2e/google-mock.ts): /api/auth/google →
// mock /auth → /api/auth/callback → signed session. Each run gets a unique hinan.<ts>@innovinlabs.com.
test.describe("Google sign-in", () => {
  test("sign-in verifies identity, locks the attendance email, and sign-out releases it", async ({ page }) => {
    await page.goto("/attendance");
    await page.getByRole("link", { name: "sign in with your Innovin Google account" }).click();

    // The mock redirects straight back through the callback with a code + state.
    await expect(page).toHaveURL(/\/attendance$/);
    await expect(page.getByText(/Checking in as/)).toContainText("Hinan E2E");
    await expect(page.getByPlaceholder("you@innovinlabs.com")).toHaveCount(0);

    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByText("Verified with Google")).toBeVisible();
    await expect(page.getByText(/hinan\.\d+@innovinlabs\.com/)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText("Verified with Google")).toBeHidden();
    await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeVisible();
  });

  test("a signed-in device cannot mark attendance for a different email", async ({ page }) => {
    await page.goto("/api/auth/google?next=/attendance");
    await expect(page).toHaveURL(/\/attendance$/);
    // Even though no email field is rendered, a forged request body can't override the session.
    await page.evaluate(async () => {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "impersonated@innovinlabs.com", action: "in" }),
      });
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();
    const status = await page.evaluate(async () => (await fetch("/api/attendance")).json());
    expect(status.email).toMatch(/^hinan\.\d+@innovinlabs\.com$/);
  });
});
