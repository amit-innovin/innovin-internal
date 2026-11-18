import { expect, test } from "./fixtures";

// Full sign-in round-trip against the Google OAuth mock (e2e/google-mock.ts): /api/auth/google →
// mock /auth → /api/auth/callback → signed session. Each run gets a unique hinan.<ts>@innovinlabs.com.
test.describe("Google sign-in", () => {
  test("sign-in cannot redirect to another host through URL normalization", async ({ page }) => {
    await page.goto(`/api/auth/google?next=${encodeURIComponent("/\\evil.example")}`);
    await expect(page).toHaveURL("http://localhost:3210/");
    const me = await page.request.get("/api/auth/me");
    expect(await me.json()).toMatchObject({ signedIn: true });
  });

});
