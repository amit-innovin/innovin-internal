import { expect, test } from "./fixtures";
import { MOCK_URL } from "./mock-url";

// Sign-in and API guards that hold whatever the screens look like.
test.describe("Sign-in and API guards", () => {
  test("new endpoints deny anonymous writes and reject invalid input", async ({ request, page }) => {
    expect((await request.post("/api/days", { data: { mode: "office" } })).status()).toBe(401);
    expect((await request.post("/api/events", { data: { title: "Forged" } })).status()).toBe(401);
    await page.goto("/api/auth/google?next=/");
    expect((await page.request.post("/api/days", { data: { mode: "admin" } })).status()).toBe(400);
  });

  test("switching Google accounts clears the previous identity before the round trip", async ({ page }) => {
    await page.goto("/api/auth/google?next=/feed");
    const before=await (await page.request.get("/api/auth/me")).json();
    const start=await page.request.get("/api/auth/google?next=/",{maxRedirects:0});
    expect(start.status()).toBe(307);
    expect((await (await page.request.get("/api/auth/me")).json()).signedIn).toBe(false);
    await page.goto(start.headers().location);
    const after=await (await page.request.get("/api/auth/me")).json();
    expect(after.signedIn).toBe(true);
    expect(after.email).not.toBe(before.email);
  });

  test("Google rejects accounts outside innovinlabs.com", async ({ page, request }) => {
    await request.get(`${MOCK_URL}/as?email=outside@gmail.com&name=Outside`);
    try {
      await page.goto("/api/auth/google?next=/");
      await expect(page).toHaveURL(/auth=failed/);
      expect((await (await page.request.get("/api/auth/me")).json()).signedIn).toBe(false);
    } finally { await request.get(`${MOCK_URL}/as?reset=1`); }
  });
});
