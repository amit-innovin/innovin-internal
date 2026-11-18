import { ADMIN_EMAIL, adminLogin, expect, test, uniqueEmail, uniqueText, signInEmployee, signInOffice } from "./fixtures";

test.describe("Notifications", () => {
  test("a kudos to you shows up, links to the Feed, and opening the page marks it read", async ({ page, browser }) => {
    const me = uniqueEmail("notif-kudos");
    await signInEmployee(page, me, "/");
    const giverContext = await browser.newContext();
    const giver = await giverContext.newPage();
    await signInEmployee(giver, uniqueEmail("notif-giver"), "/");
    expect((await giver.request.post("/api/notices", { data: { kind: "kudos", toEmail: me, body: "Thanks for covering" } })).status()).toBe(201);
    await giverContext.close();
    expect((await (await page.request.get("/api/notifications")).json()).unread).toBeGreaterThan(0);
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    const kudos = page.getByRole("link", { name: /Notif-giver gave you kudos/ });
    await expect(kudos).toBeVisible();
    await expect.poll(async () => (await (await page.request.get("/api/notifications")).json()).unread).toBe(0);
    await kudos.click();
    await expect(page).toHaveURL(/\/feed$/);
  });

  test("the tea reminder shows while the round is open and you haven't answered", async ({ page, browser }) => {
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await signInEmployee(admin, ADMIN_EMAIL, "/");
    const times = (t: object) => admin.request.patch("/api/admin/snack-times", { data: { amAt: "11:00", amClose: "10:45", pmAt: "16:00", pmClose: "15:30", orderAt: "12:00", ...t } });
    try {
      expect((await times({ amAt: "23:58", amClose: "23:57", pmAt: "23:59", pmClose: "23:58" })).status()).toBe(200);
      await signInOffice(page, uniqueEmail("notif-tea"));
      await page.goto("/notifications");
      const tea = page.getByRole("link", { name: /^Tea round closes at/ });
      await expect(tea).toHaveAttribute("href", "/snacks");
      expect((await page.request.post("/api/tea", { data: { round: "am", going: true } })).status()).toBe(200);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
      await expect(tea).toHaveCount(0);
    } finally {
      await times({});
      await adminContext.close();
    }
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
    // Laptop Home lists the next events in its right rail ("Coming up"); phone Home shows only
    // the single next event, which other specs' events can outrank, so it isn't asserted there.
    if (!isMobile) await expect(page.getByRole("complementary", { name: "Coming up" })).toContainText(title);
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
