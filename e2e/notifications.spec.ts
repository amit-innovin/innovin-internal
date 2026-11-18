import { ADMIN_EMAIL, expect, test, uniqueEmail, uniqueText, signInEmployee, signInOffice } from "./fixtures";

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

  test("a published event reaches Notifications and opens its page", async ({ page, browser }) => {
    const title = uniqueText("Town hall");
    const admin = await browser.newContext();
    const a = await admin.newPage();
    await signInEmployee(a, ADMIN_EMAIL, "/admin");
    const soon = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
    const res = await a.request.post("/api/events", { data: { title, category: "company", startsAt: `${soon}T09:00`, body: "", location: "Big room" } });
    expect(res.status()).toBe(201);
    const id = (await res.json()).event.id;
    try {
      // (Home's Up next shows only the soonest event, which other specs' events can be.)
      await signInEmployee(page, undefined, "/notifications");
      await page.getByRole("link").filter({ hasText: title }).click();
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    } finally {
      await a.request.post("/api/events", { data: { action: "delete", id } });
      await admin.close();
    }
  });

  test("a leave decision notifies the person who asked", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("leave-note"), "/");
    const day = new Date(Date.now() + 5.5 * 3600_000 + 7 * 86_400_000);
    while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
    const date = day.toISOString().slice(0, 10);
    const req = await (await page.request.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: date, endDate: date, reason: uniqueText("dentist") } })).json();
    const admin = await browser.newContext();
    const a = await admin.newPage();
    await signInEmployee(a, ADMIN_EMAIL, "/admin");
    expect((await a.request.patch("/api/away", { data: { id: req.id, status: "approved" } })).status()).toBe(200);
    await admin.close();
    await page.goto("/notifications");
    await expect(page.getByRole("link").filter({ hasText: /leave approved/i })).toBeVisible();
  });

  test("Speak up updates reach only the device that sent the message", async ({ page, browser }) => {
    const text = uniqueText("Chair is broken");
    const sent = await page.request.post("/api/grievances", { data: { body: text, topic: "Facilities" } });
    expect(sent.ok()).toBe(true);
    const id = (await sent.json()).id;
    const admin = await browser.newContext();
    const a = await admin.newPage();
    await signInEmployee(a, ADMIN_EMAIL, "/admin");
    expect((await a.request.patch("/api/grievances", { data: { id, status: "resolved" } })).ok()).toBe(true);
    await admin.close();

    // The sending device holds the message's id in its own cookie, so it sees the update.
    const mine = await (await page.request.get("/api/notifications")).json();
    expect(JSON.stringify(mine)).not.toContain("submitterRef");
    expect(mine.items.some((i: { kind: string }) => i.kind === "grievance")).toBe(true);
    // Another device holds no ids, so it gets no Speak up items at all.
    const other = await browser.newContext();
    const feed = await (await other.request.get("http://localhost:3210/api/notifications")).json();
    expect((feed.items ?? []).some((i: { kind: string }) => i.kind === "grievance")).toBe(false);
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
