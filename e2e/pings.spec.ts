import { expect, test, uniqueText } from "./fixtures";
import type { Browser } from "@playwright/test";

// The mock Google provider pins who signs in, then the round-trip completes in the browser.
const MOCK = "http://localhost:3999";
async function signInAs(browser: Browser, email: string, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.request.get(`${MOCK}/as?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
  await page.goto("/api/auth/google?next=/settings");
  await expect(page.getByText("Verified with Google")).toBeVisible();
  await page.request.get(`${MOCK}/as?reset=1`);
  return { ctx, page };
}

test.describe("Pings", () => {
  test("a ping reaches the other person and they can answer — no history kept", async ({ browser }) => {
    const sender = uniqueText("Pam");
    const receiver = uniqueText("Raj");
    const a = await signInAs(browser, `pa.${Date.now().toString(36)}@innovinlabs.com`, sender);
    const b = await signInAs(browser, `pb.${Date.now().toString(36)}@innovinlabs.com`, receiver);

    // A finds B in the directory and taps a preset nudge.
    await a.page.goto("/people");
    await a.page.getByRole("button", { name: `Ping ${receiver}` }).first().click();
    const sheet = a.page.getByRole("dialog", { name: `Ping ${receiver}` });
    await expect(sheet.getByText("Pings vanish after 24 hours")).toBeVisible();
    await sheet.getByRole("button", { name: "☕ Chai?" }).click();
    await expect(sheet.getByText("☕ Chai?")).toBeVisible();

    // B sees the thread in the Pings inbox with an unread badge, opens it, replies.
    await b.page.goto("/people");
    const inbox = b.page.locator("[data-slot=card]").filter({ has: b.page.getByRole("heading", { name: /Pings/ }) });
    const thread = inbox.locator("li", { hasText: sender });
    await expect(thread).toContainText("☕ Chai?");
    await thread.getByRole("button").click();
    const bSheet = b.page.getByRole("dialog", { name: `Ping ${sender}` });
    await expect(bSheet.getByText("☕ Chai?")).toBeVisible();
    await bSheet.getByLabel("Ping message").fill("5 mins, coming");
    await bSheet.getByRole("button", { name: "Send ping" }).click();
    await expect(bSheet.getByText("5 mins, coming")).toBeVisible();

    // A's open sheet picks the reply up on its next poll.
    await expect(sheet.getByText("5 mins, coming")).toBeVisible({ timeout: 15_000 });

    // Reopening People: the thread is read — no unread badge left on it.
    await b.page.goto("/people");
    const inbox2 = b.page.locator("[data-slot=card]").filter({ has: b.page.getByRole("heading", { name: /Pings/ }) });
    await expect(inbox2.locator("li", { hasText: sender })).toContainText("5 mins, coming");

    await a.ctx.close();
    await b.ctx.close();
  });

  test("unsigned visitors get no ping surface, and the API refuses them", async ({ page }) => {
    await page.goto("/people");
    await expect(page.getByRole("button", { name: /Ping / })).toHaveCount(0);
    expect((await page.request.post("/api/pings", { data: { to: "x@innovinlabs.com", body: "hi" } })).status()).toBe(401);
  });

  test("you can't ping yourself or a stranger, and the cap is enforced", async ({ browser }) => {
    const me = uniqueText("Solo");
    const email = `solo.${Date.now().toString(36)}@innovinlabs.com`;
    const { ctx, page } = await signInAs(browser, email, me);
    await page.goto("/people");
    await expect(page.getByRole("button", { name: `Ping ${me}` })).toHaveCount(0);

    const self = await page.request.post("/api/pings", { data: { to: email, body: "hi" } });
    expect(self.status()).toBe(400);
    const ghost = await page.request.post("/api/pings", { data: { to: "ghost@innovinlabs.com", body: "hi" } });
    expect(ghost.status()).toBe(400);
    const long = await page.request.post("/api/pings", { data: { to: "ghost@innovinlabs.com", body: "x".repeat(141) } });
    expect(long.status()).toBe(400);
    await ctx.close();
  });
});
