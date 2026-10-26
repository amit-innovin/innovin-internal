import { expect, test, uniqueText } from "./fixtures";

test.describe("Studio workspace", () => {
  test("onboarding offers only company Google sign-in and a responsive badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Manage your workspace with clarity" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).not.toHaveCSS("background-image", "none");
    await expect(page.getByText("@innovinlabs.com accounts only", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/onboarding-front-${test.info().project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Flip workspace pass" }).click();
    await expect(page.getByText("ATTENDANCE LOG", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/onboarding-${test.info().project.name}.png`, fullPage: true });
  });

  test("office mode persists and pantry enforces remote and office rules on the server", async ({ page, browser, isMobile }) => {
    await page.goto("/api/auth/google?next=/");
    await expect(page.getByRole("heading", { name: "Your workspace" })).toBeVisible();
    const profile = page.getByRole("button", { name: "Edit profile" }).first();
    await profile.click();
    await page.getByLabel("Job title").fill("Product Designer");
    await page.getByLabel("Project").fill("Workspace portal");
    await page.getByLabel("Department").fill("Design");
    await page.getByRole("button", { name: "Save profile" }).click();
    if (isMobile) await page.getByRole("button", { name: "Expand People in Office" }).click();
    await page.getByRole("button", { name: "Share status ☕" }).click();
    await expect.poll(async () => (await (await page.request.get("/api/workspace")).json()).profile.focus).toBe("☕");
    await page.getByRole("button", { name: "Zoom in arena" }).click();
    await expect(page.locator(".zoom-level-pill")).toHaveText("95%");
    if (isMobile) await page.getByRole("button", { name: "Expand Pantry", exact: true }).click();
    await page.getByRole("button", { name: "Remote", exact: true }).click();
    await expect(page.getByText("The pantry is an office perk.")).toBeVisible();
    const denied = await page.request.post("/api/snacks", { data: { items: ["tea"] } });
    expect(denied.status()).toBe(403);
    await page.getByRole("button", { name: "In office", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search pantry" }).fill("Tea");
    await page.getByRole("button", { name: "Add Tea" }).click();
    await expect(page.getByText("Tea", { exact: true }).first()).toBeVisible();

    await expect(page.getByRole("status").filter({ hasText: "Your tray is saved." })).toBeAttached();
    const mine = await (await page.request.get("/api/snacks?scope=mine")).json();
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0].orderedBy).toMatch(/@innovinlabs.com$/);
    const otherDevice = await browser.newContext({ storageState: { cookies: (await page.context().cookies()).filter((c) => c.name === "innovin_user"), origins: [] } });
    expect((await (await otherDevice.request.get("http://localhost:3210/api/snacks?scope=mine")).json()).items).toHaveLength(1);
    await otherDevice.close();
    expect((await page.request.post("/api/snacks", { data: { items: ["tea", "snacks", "healthy", "lunch", "dinner"] } })).status()).toBe(400);
    await page.reload();
    await expect(page.getByRole("button", { name: "In office", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Product Designer", { exact: true }).first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/workspace-${test.info().project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Check out", exact: true }).click();
    expect((await page.request.post("/api/snacks", { data: { items: ["tea"] } })).status()).toBe(403);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("employees publish real events and RSVP", async ({ page, isMobile }) => {
    await page.goto("/api/auth/google?next=/");
    if (isMobile) await page.getByRole("button", { name: "Expand Events", exact: true }).click();
    await page.getByRole("button", { name: "Add event" }).click();
    const title = uniqueText("Design sharing");
    await page.getByLabel("Event title").fill(title);
    const future = new Date(Date.now() + 86400000 * 2 + 19800000).toISOString().slice(0, 16);
    await page.getByLabel("Date & time (IST)").fill(future);
    await page.getByLabel("Location").fill("Studio");
    await page.getByRole("button", { name: "Publish event" }).click();
    const event = page.locator("article").filter({ hasText: title });
    await expect(event).toBeVisible();
    await event.getByRole("button", { name: "RSVP" }).click();
    await expect(event.getByRole("button", { name: "Going" })).toBeVisible();
    await page.reload();
    if (isMobile) await page.getByRole("button", { name: "Expand Events", exact: true }).click();
    await expect(page.locator("article").filter({ hasText: title }).getByRole("button", { name: "Going" })).toBeVisible();
  });

  test("calendar editing persists without rewriting attendance or HR approvals", async ({ page }) => {
    await page.goto("/api/auth/google?next=/planner");
    await page.getByRole("button", { name: /Select .*15$/ }).click();
    await page.getByRole("button", { name: "🌴 Vacation", exact: true }).click();
    await expect(page.getByText("Calendar updated")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Select .*15$/ })).toContainText("🌴");
    await expect(page.getByText(/Personal plans.*HR approval/)).toBeVisible();
    await page.getByRole("button", { name: /Select .*15$/ }).click();
    await page.getByRole("button", { name: "Clear day", exact: true }).click();
    await expect(page.getByText("Calendar updated")).toBeVisible();
  });

  test("new endpoints deny anonymous writes and reject invalid dates", async ({ request, page }) => {
    expect((await request.post("/api/workspace", { data: { mode: "office" } })).status()).toBe(401);
    expect((await request.post("/api/planner", { data: { date: "2026-10-15", kind: "office" } })).status()).toBe(401);
    expect((await request.post("/api/events", { data: { title: "Forged" } })).status()).toBe(401);
    await page.goto("/api/auth/google?next=/");
    expect((await page.request.post("/api/planner", { data: { date: "2026-02-29", kind: "office" } })).status()).toBe(400);
    expect((await page.request.post("/api/workspace", { data: { mode: "admin" } })).status()).toBe(400);
  });

  test("steps and paper notes save through their owning APIs", async ({ page, browser }) => {
    const peer = await browser.newContext();
    const peerPage = await peer.newPage();
    await peerPage.goto("http://localhost:3210/api/auth/google?next=/settings");
    await expect(peerPage.getByText("Verified with Google")).toBeVisible();
    await peer.close();
    await page.goto("/api/auth/google?next=/steps");
    await page.getByLabel("Today's total steps").fill("12450");
    await page.getByRole("button", { name: "Save today's steps" }).click();
    await expect(page.getByText("Today's steps saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Today's total steps")).toHaveValue("12450");
    await page.getByRole("button", { name: "10k+ days", exact: true }).click();
    await expect(page.locator(".ranking-list .is-me")).toContainText("1");
    await page.getByRole("button", { name: "Write a paper note" }).click();
    const recipient = await page.getByRole("combobox", { name: "To", exact: true }).locator('option[value$="@innovinlabs.com"]').first().getAttribute("value");
    await page.getByRole("combobox", { name: "To", exact: true }).selectOption(recipient!);
    const text = uniqueText("Thanks for the help");
    await page.getByLabel("Your note", { exact: true }).fill(text);
    await page.getByRole("button", { name: "Send airplane" }).click();
    await expect(page.getByText("Your note is on its way")).toBeVisible();
    const thread = await (await page.request.get(`/api/pings?with=${encodeURIComponent(recipient!)}`)).json();
    expect(thread.messages.some((m: { body: string; mine: boolean }) => m.body.includes(text) && m.mine)).toBe(true);
    await page.getByRole("button", { name: "Write a paper note" }).click();
    await page.getByLabel("Your note", { exact: true }).fill("Discard me");
    await page.getByRole("button", { name: "Crumple and discard note" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".paper-animation")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/steps-${test.info().project.name}.png`, fullPage: true });
  });

  test("switching Google accounts clears the previous identity before the round trip", async ({ page, isMobile }) => {
    await page.goto("/api/auth/google?next=/");
    const before=await (await page.request.get("/api/auth/me")).json();
    if (isMobile) {
      await expect(page.getByRole("link", { name: "Switch account", exact: true })).toBeVisible();
    } else {
      await page.getByLabel("Your Google account").click();
      await expect(page.getByRole("link", { name: "Switch Google account" })).toBeVisible();
    }
    const start=await page.request.get("/api/auth/google?next=/",{maxRedirects:0});
    expect(start.status()).toBe(307);
    expect((await (await page.request.get("/api/auth/me")).json()).signedIn).toBe(false);
    await page.goto(start.headers().location);
    const after=await (await page.request.get("/api/auth/me")).json();
    expect(after.signedIn).toBe(true);
    expect(after.email).not.toBe(before.email);
  });

  test("Google rejects accounts outside innovinlabs.com", async ({ page, request }) => {
    await request.get("http://localhost:3999/as?email=outside@gmail.com&name=Outside");
    try {
      await page.goto("/api/auth/google?next=/");
      await expect(page).toHaveURL(/auth=failed/);
      expect((await (await page.request.get("/api/auth/me")).json()).signedIn).toBe(false);
    } finally { await request.get("http://localhost:3999/as?reset=1"); }
  });
});
