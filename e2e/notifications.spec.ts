import { adminLogin, expect, test, uniqueEmail, uniqueText, signInEmployee } from "./fixtures";

test.describe("Notifications", () => {
  test("the bell opens the Notifications page, and Mark all read clears the unread count", async ({ page, browser }) => {
    const title = uniqueText("Lift under maintenance");
    const admin = await browser.newContext();
    const a = await admin.newPage();
    await adminLogin(a, "publish");
    await a.getByRole("tab", { name: "Announcement" }).click();
    await a.getByLabel("Title", { exact: true }).fill(title);
    await a.getByRole("button", { name: "Post announcement" }).click();
    await expect(a.getByText("Announcement posted")).toBeVisible();
    await admin.close();

    await signInEmployee(page, undefined, "/");
    const bell = page.getByRole("link", { name: /Notifications/ }).filter({ visible: true });
    // Unread count shows in the accessible name, so it's announced not just coloured.
    await expect(bell).toHaveAccessibleName(/\d+ unread/);
    await bell.click();
    // The bell goes to its own page: not the Feed, not a popover.
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    const row = page.getByRole("link").filter({ hasText: title });
    await expect(row).toHaveAttribute("data-unread", "true");

    // The Unread filter is a link, so it survives a reload.
    await page.getByRole("link", { name: /^Unread/ }).click();
    await expect(page).toHaveURL(/filter=unread/);
    await expect(row).toBeVisible();

    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByText("You're all caught up")).toBeVisible();
    await expect(page.getByText("Nothing unread")).toBeVisible();
    await page.goto("/notifications");
    await expect(row).toHaveAttribute("data-unread", "false");

    // Back on Home the bell no longer announces a count.
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Notifications", exact: true }).filter({ visible: true })).toBeVisible();
  });

  test("a published event reaches the feed and home", async ({ page, browser, isMobile }) => {
    const title = uniqueText("Town hall");
    const admin = await browser.newContext();
    const a = await admin.newPage();
    await adminLogin(a, "publish");
    await a.getByRole("tab", { name: "Event" }).click();
    await a.getByLabel("Event title").fill(title);
    // Tomorrow, so it always outranks other specs' fixed-date leftovers on the persistent
    // e2e database — home's "What's on" card shows only the two soonest events.
    const soon = new Date(Date.now() + 86_400_000);
    const startsAt = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}T10:00`;
    await a.getByLabel("Starts at").fill(startsAt);
    await a.getByRole("button", { name: "Publish event" }).click();
    await expect(a.getByText("Event published")).toBeVisible();

    await signInEmployee(page, undefined, "/");
    if (isMobile) await page.getByRole("button", { name: "Expand Events", exact: true }).click();
    // Events used to be invisible on home; they now have their own card.
    await expect(page.locator(".events-card")).toContainText(title);
    await page.getByRole("link", { name: /Notifications/ }).filter({ visible: true }).click();
    await expect(page.getByRole("link").filter({ hasText: title })).toBeVisible();

    // Clean up after ourselves — leftover rows would crowd tomorrow's run off the card.
    await a.goto("/admin?tab=publish");
    const item = a.locator("li", { hasText: title });
    await item.getByLabel(`Delete ${title}`).click();
    await a.getByRole("button", { name: "Delete" }).click();
    await expect(a.getByText("Event deleted")).toBeVisible();
    await admin.close();
  });

  test("a leave decision notifies the person who asked", async ({ page, browser }) => {
    const reason = uniqueText("dentist");
    const employee = await browser.newContext();
    const e = await employee.newPage();
    // Signed in, so the decision can be tied to an identity.
    await e.goto("/api/auth/google?next=/attendance");
    await e.getByRole("tab", { name: "Leave" }).click();
    await e.locator("#away-start").fill("2026-11-17");
    await e.locator("#away-end").fill("2026-11-17");
    await e.getByLabel("Reason").fill(reason);
    await e.getByRole("button", { name: "Request Leave" }).click();
    await expect(e.getByText("Leave request sent")).toBeVisible();

    await adminLogin(page, "approvals");
    await page.locator("li", { hasText: reason }).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved")).toBeVisible();

    await e.goto("/");
    await e.getByRole("link", { name: /Notifications/ }).filter({ visible: true }).click();
    await expect(e.getByRole("link").filter({ hasText: /leave approved/i })).toBeVisible();
    await employee.close();
  });

  test("the Notifications page sits in the new shell: bottom bar on phones, sidebar on wider screens", async ({ page, isMobile }) => {
    await signInEmployee(page, uniqueEmail("shell"), "/notifications");
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    // The legacy top bar is not rendered on a rebuilt screen.
    await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toHaveCount(0);
    const main = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    await expect(main).toHaveCount(1);
    if (isMobile) {
      await expect(main.getByRole("link")).toHaveText(["Home", "Feed", "Days", "Account"]);
      // A child screen on the phone has a way back to Home.
      await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
    } else {
      await expect(main.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
      await main.getByRole("button", { name: "Account menu" }).click();
      const menu = page.getByRole("menu", { name: "Account" });
      await expect(menu.getByRole("menuitem")).toHaveText(["Settings", "Speak up", "Wi-Fi check", "Help", "Sign out"]);
      // A member never sees Admin.
      await expect(menu.getByRole("menuitem", { name: "Admin" })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }
    // Home stays lit: Notifications belongs to Home.
    await expect(main.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: `output/playwright/duo-notifications-${test.info().project.name}.png`, fullPage: true });
    if (!isMobile) {
      await page.setViewportSize({ width: 834, height: 1100 });
      await page.screenshot({ path: "output/playwright/duo-notifications-tablet.png" });
    }
  });

  test("the feed is device-scoped for grievances and never leaks between devices", async ({ page, browser }) => {
    const text = uniqueText("Chair is broken");
    await page.goto("/grievances");
    await page.getByLabel("Your feedback").fill(text);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator("#mine li", { hasText: text })).toContainText("Open");

    // Resolve it as admin, from a different context.
    const admin = await browser.newContext();
    const a = await admin.newPage();
    await adminLogin(a, "approvals");
    await a.locator("li", { hasText: text }).getByLabel("Status").click();
    await a.getByRole("option", { name: "Resolved" }).click();
    await expect(a.getByText(/Marked as resolved/i)).toBeVisible();
    await admin.close();

    // The submitting device sees it, because it holds the grievance id in its own cookie.
    const mine = await (await page.request.get("/api/notifications")).json();
    expect(JSON.stringify(mine)).not.toContain("submitterRef");
    expect(mine.items.some((i: { kind: string; body: string }) => i.kind === "grievance" && text.includes(i.body.slice(0, 20)))).toBe(true);

    // Another device holds no ids, so it gets no grievance items at all.
    const other = await browser.newContext();
    const feed = await (await other.request.get(`${page.url().replace(/\/grievances.*/, "")}/api/notifications`)).json();
    expect(feed.items.some((i: { kind: string }) => i.kind === "grievance")).toBe(false);
    await other.close();
  });

  test("push exposes only the public key, and rejects junk subscriptions", async ({ page }) => {
    const config = await (await page.request.get("/api/push")).json();
    expect(config).toHaveProperty("enabled");
    // The private key must never be served.
    expect(JSON.stringify(config)).not.toContain("PRIVATE");
    expect(Object.keys(config).sort()).toEqual(["enabled", "publicKey"]);

    if (config.enabled) {
      const bad = await page.request.post("/api/push", { data: { endpoint: "javascript:alert(1)", keys: { p256dh: "x", auth: "y" } } });
      expect(bad.status()).toBe(400);
      for (const endpoint of ["https://127.0.0.1/private", "https://internal.example/private", "https://fcm.googleapis.com.evil.example/token"]) {
        expect((await page.request.post("/api/push", { data: { endpoint, keys: { p256dh: "x", auth: "y" } } })).status()).toBe(400);
      }
      const missing = await page.request.post("/api/push", { data: { endpoint: "https://push.example.com/x" } });
      expect(missing.status()).toBe(400);
    }
  });
});
