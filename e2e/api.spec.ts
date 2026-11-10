import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { MAIN_URL } from "../playwright.config";

// HTTP-level verification of validation, auth, privacy, idempotency and abuse limits.
let seq = 0;
const ip = () => `203.0.113.${(++seq % 250) + 1}-${Date.now()}`;
const email = () => `api.${Date.now().toString(36)}${++seq}@innovinlabs.com`;

async function device(baseURL = MAIN_URL, headers: Record<string, string> = {}) {
  return request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip(), ...headers } });
}

// Admin is a Google identity with the admin role (ADMIN_EMAILS in playwright.config).
async function admin(): Promise<APIRequestContext> {
  return signedIn("admin@innovinlabs.com", "Admin E2E");
}

const noRef = (body: unknown) => expect(JSON.stringify(body)).not.toContain("submitterRef");

// A context signed in through the Google OAuth mock as a specific person, so per-identity
// features (leave balances) can be exercised. `/as` pins the mock's next identity.
async function signedIn(who: string, name = who): Promise<APIRequestContext> {
  const ctx = await device();
  await ctx.get(`http://localhost:3999/as?email=${encodeURIComponent(who)}&name=${encodeURIComponent(name)}`);
  const res = await ctx.get("/api/auth/google?next=/", { maxRedirects: 10 });
  expect(res.ok()).toBe(true);
  await ctx.get("http://localhost:3999/as?reset=1");
  return ctx;
}

async function officeDevice() {
  const ctx = await signedIn(email());
  expect((await ctx.post("/api/workspace", { data: { mode: "office" } })).status()).toBe(200);
  return ctx;
}

test.describe("API: removed features", () => {
  for (const path of ["/api/snacks", "/api/pantry-shop", "/api/pantry-provider", "/api/pings"]) {
    test(`removed API ${path} is gone`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }
});

test.describe("API: notifications", () => {
  test("signed-in notifications only carry the four remaining kinds", async () => {
    const ctx = await signedIn(email());
    const res = await ctx.get("/api/notifications");
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const item of body.items) expect(["announcement", "event", "away", "grievance"]).toContain(item.kind);
  });
});

test.describe("API: input validation", () => {
  test("malformed or non-object JSON bodies return 400, never 500", async () => {
    const ctx = await officeDevice();
    for (const path of ["/api/attendance", "/api/grievances", "/api/wifi", "/api/away"]) {
      for (const body of ["{bad", "[1,2]", "null", '"text"']) {
        const res = await ctx.post(path, { data: body, headers: { "Content-Type": "application/json" } });
        expect(res.status(), `${path} ${body}`).toBe(400);
      }
    }
  });

  test("attendance requires identity and validates the action", async () => {
    const guest = await device();
    for (const who of ["nope", "a@gmail.com", email()]) {
      expect((await guest.post("/api/attendance", { data: { email: who, action: "in" } })).status()).toBe(401);
    }
    for (const path of ["/api/attendance", "/api/attendance?month=2026-10", "/api/people", "/api/steps"]) {
      expect((await guest.get(path)).status()).toBe(401);
    }
    const ctx = await signedIn(email());
    expect((await ctx.post("/api/attendance", { data: { action: "dance" } })).status()).toBe(400);
    expect((await ctx.post("/api/attendance", { data: { action: "out" } })).status()).toBe(404);
  });

  test("wifi and grievances reject invalid payloads", async () => {
    const ctx = await officeDevice();
    expect((await ctx.post("/api/wifi", { data: { quality: "meh" } })).status()).toBe(400);
    expect((await ctx.post("/api/wifi", { data: { quality: "good", downMbps: -1 } })).status()).toBe(400);
    expect((await ctx.post("/api/wifi", { data: { quality: "good", downMbps: "fast" } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: "   " } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: 123 } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: "x", image: "data:text/html;base64,PGI+" } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: "x", image: "not-a-data-url" } })).status()).toBe(400);
  });

  test("time away requires identity and validates type and the date range", async () => {
    const guest = await device();
    expect((await guest.post("/api/away", { data: { email: email(), type: "wfh", startDate: "2026-11-09", endDate: "2026-11-09" } })).status()).toBe(401);
    const who = email();
    const ctx = await signedIn(who);
    const cases: [unknown, number][] = [
      [{ email: who, type: "sabbatical", startDate: "2026-10-07", endDate: "2026-10-07" }, 400],
      [{ email: who, type: "leave", leaveType: "cl", startDate: "07/10/2026", endDate: "2026-10-08" }, 400],
      [{ email: who, type: "leave", leaveType: "cl", startDate: "2026-10-08", endDate: "2026-10-07" }, 400],
      [{ email: who, type: "leave", leaveType: "cl", startDate: "2026-01-01", endDate: "2026-12-31" }, 400],
      [{ email: who, type: "leave", leaveType: "holiday", startDate: "2026-10-07", endDate: "2026-10-07" }, 400], // unknown bucket
      [{ email: who, type: "wfh", startDate: "2026-10-07", endDate: "2026-10-07" }, 200],
    ];
    for (const [data, status] of cases) expect((await ctx.post("/api/away", { data })).status(), JSON.stringify(data)).toBe(status);
  });

  test("long inputs are truncated server-side", async () => {
    const ctx = await officeDevice();
    const g = await (await ctx.post("/api/grievances", { data: { body: "x".repeat(5000), displayName: "n".repeat(500) } })).json();
    expect(g.body).toHaveLength(2000);
    expect(g.displayName).toHaveLength(100);
  });
});

test.describe("API: behaviour", () => {
  test("check-in/out cycles: one row per day — repeat check-in is a no-op, re-check-in reopens it", async () => {
    const who = email();
    const ctx = await signedIn(who);
    const first = await (await ctx.post("/api/attendance", { data: { email: who, action: "in" } })).json();
    const again = await (await ctx.post("/api/attendance", { data: { email: ` ${who.toUpperCase()} `, action: "in" } })).json();
    expect(again.id).toBe(first.id);
    const out = await (await ctx.post("/api/attendance", { data: { email: who, action: "out" } })).json();
    expect(out.id).toBe(first.id);
    expect(out.checkOutAt).toBeTruthy();
    // Checked out now — a second checkout is refused, and checking in again reopens the day.
    expect((await ctx.post("/api/attendance", { data: { email: who, action: "out" } })).status()).toBe(404);
    const second = await (await ctx.post("/api/attendance", { data: { email: who, action: "in" } })).json();
    expect(second.id).toBe(first.id);
    const mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.me.checkedIn).toBe(true);
    expect(mine.me.checkOutAt).toBeNull();
  });

  test("attendance GET exposes only the count and the caller's own status", async () => {
    const who = email();
    const ctx = await signedIn(who);
    await ctx.post("/api/attendance", { data: { email: who, action: "in" } });
    const mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.email).toBe(who);
    expect(mine.me.checkedIn).toBe(true);
    expect(mine.me.checkInAt).toBeTruthy();
    expect(mine.me.checkOutAt).toBeNull();
    // `office` (the geofence) and `onOfficeNetwork` are exposed on purpose — the client needs
    // them to decide auto check-in. Everyone else's sessions stay hidden.
    expect(Object.keys(mine).sort()).toEqual(["count", "email", "me", "office", "onOfficeNetwork"]);

    const stranger = await (await (await signedIn(email())).get("/api/attendance")).json();
    expect(stranger.count).toBe(mine.count);
    expect(stranger.email).not.toBe(who);
    expect(stranger.me).toBeNull();
  });

  test("check-in coordinates are classified against the office geofence, raw coords never returned", async () => {
    const who = email();
    const ctx = await signedIn(who);
    // Inside the configured fake office (12.935,77.624 ±1km).
    await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 12.9352, lng: 77.6241, accuracyM: 15 } });
    let mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.me.location).toBe("office");
    // The submitted coordinates never echo back — only the classification does. (The office's
    // own geofence config is deliberately exposed for client-side auto check-in.)
    expect(JSON.stringify(mine)).not.toContain("77.6241");
    expect(JSON.stringify(mine)).not.toContain("12.9352");

    // Back in from far away reopens the same day-row as remote; invalid coords are rejected.
    await ctx.post("/api/attendance", { data: { email: who, action: "out" } });
    await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 13.05, lng: 77.6 } });
    mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.me.checkedIn).toBe(true);
    expect(mine.me.location).toBe("remote");
    expect(JSON.stringify(mine)).not.toContain("13.05");
    expect((await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 200, lng: 0 } })).status()).toBe(400);
    expect((await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 12.9 } })).status()).toBe(400);
  });

  test("Google auth: start redirects, callback rejects forged state, session overrides attendance email", async () => {
    const ctx = await device();
    expect(await (await ctx.get("/api/auth/me")).json()).toEqual({ signedIn: false, googleEnabled: true });

    // A callback hit without the state cookie bounces to sign-in?auth=failed.
    const bad = await ctx.get("/api/auth/callback?code=x&state=bogus.abc", { maxRedirects: 0 });
    expect(bad.status()).toBe(307);
    expect(bad.headers()["location"]).toContain("/sign-in?auth=failed");

    // Full round-trip through the mock: google → mock auth → callback → session.
    const start = await ctx.get("/api/auth/google?next=/attendance", { maxRedirects: 0 });
    expect(start.status()).toBe(307);
    expect(start.headers()["location"]).toContain("localhost:3999/auth");
    const bounced = await ctx.get(start.headers()["location"], { maxRedirects: 0 });
    expect(bounced.status()).toBe(302);
    const done = await ctx.get(bounced.headers()["location"], { maxRedirects: 0 });
    expect(done.headers()["location"]).toContain("/attendance");

    const me = await (await ctx.get("/api/auth/me")).json();
    expect(me.signedIn).toBe(true);
    expect(me.email).toMatch(/^hinan\.\d+@innovinlabs\.com$/);
    expect(me.name).toBe("Hinan E2E");

    // The session email wins over a forged body.
    await ctx.post("/api/attendance", { data: { email: "forged@innovinlabs.com", action: "in" } });
    const att = await (await ctx.get("/api/attendance")).json();
    expect(att.email).toBe(me.email);
    const away = await (
      await ctx.post("/api/away", { data: { email: "forged@innovinlabs.com", type: "wfh", startDate: "2026-10-07", endDate: "2026-10-07" } })
    ).json();
    expect(away.email).toBe(me.email);
  });

  test("time away: a request is visible to its device and admin, and approval flows through", async () => {
    const who = email();
    const ctx = await signedIn(who);
    const req = await (
      await ctx.post("/api/away", { data: { email: who, type: "leave", leaveType: "cl", startDate: "2026-11-02", endDate: "2026-11-03", reason: "trip" } })
    ).json();
    expect(req).toMatchObject({ email: who, type: "leave", status: "pending", reason: "trip" });
    noRef(req);

    const mine = await (await ctx.get("/api/away?scope=mine")).json();
    expect(mine.map((r: { id: string }) => r.id)).toContain(req.id);
    noRef(mine);
    expect((await (await device()).get("/api/away?scope=mine")).status()).toBe(401);

    const adm = await admin();
    const all = await (await adm.get("/api/away")).json();
    expect(all.find((r: { id: string }) => r.id === req.id)).toMatchObject({ email: who, status: "pending" });
    noRef(all);

    expect((await adm.patch("/api/away", { data: { id: req.id, status: "pending" } })).status()).toBe(400);
    expect((await adm.patch("/api/away", { data: { id: "missing", status: "approved" } })).status()).toBe(404);
    expect((await adm.patch("/api/away", { data: { id: req.id, status: "approved" } })).status()).toBe(200);
    const after = await (await ctx.get("/api/away?scope=mine")).json();
    expect(after.find((r: { id: string }) => r.id === req.id).status).toBe("approved");
  });

  test("leave history and cancellation follow the employee across account switching", async () => {
    const who = email();
    const ctx = await signedIn(who);
    const created = await (await ctx.post("/api/away", { data: { type: "wfh", startDate: "2026-11-09", endDate: "2026-11-09", reason: "private reason" } })).json();
    const secondDevice = await signedIn(who);
    expect((await (await secondDevice.get("/api/away?scope=mine")).json()).some((r: { id: string }) => r.id === created.id)).toBe(true);
    await ctx.post("/api/auth/logout");
    expect((await ctx.get("/api/away?scope=mine")).status()).toBe(401);
    expect((await ctx.patch("/api/away", { data: { id: created.id, status: "cancelled" } })).status()).toBe(403);
    await ctx.get(`http://localhost:3999/as?email=${encodeURIComponent(email())}`);
    try { await ctx.get("/api/auth/google?next=/"); }
    finally { await ctx.get("http://localhost:3999/as?reset=1"); }
    expect((await (await ctx.get("/api/away?scope=mine")).json()).some((r: { id: string }) => r.id === created.id)).toBe(false);
    expect((await ctx.patch("/api/away", { data: { id: created.id, status: "cancelled" } })).status()).toBe(403);
    expect((await secondDevice.patch("/api/away", { data: { id: created.id, status: "cancelled" } })).status()).toBe(200);
  });

  test("leave is charged in working days, skipping Sundays, 2nd/4th Saturdays and holidays", async () => {
    const who = email();
    const ctx = await signedIn(who);
    const mk = (data: Record<string, unknown>) => ctx.post("/api/away", { data: { email: who, ...data } });

    // Mon 7 Sep 2026 → Mon 14 Sep spans 8 calendar days but only 6 working ones:
    // Sat 12th is the 2nd Saturday and the 13th is a Sunday.
    const span = await (await mk({ type: "leave", leaveType: "cl", startDate: "2026-09-07", endDate: "2026-09-14" })).json();
    expect(span.days).toBe(6);

    // A holiday inside the range is free: Ramzan falls on Fri 20 Mar 2026.
    const holiday = await (await mk({ type: "leave", leaveType: "sl", startDate: "2026-03-19", endDate: "2026-03-23" })).json();
    expect(holiday.days).toBe(3);

    // A day that isn't a working day at all can't be booked as leave.
    const sunday = await mk({ type: "leave", leaveType: "cl", startDate: "2026-09-06", endDate: "2026-09-06" });
    expect(sunday.status()).toBe(400);
    expect((await sunday.json()).error).toContain("Sunday");

    // Half days are Casual Leave, single day only.
    const half = await (await mk({ type: "leave", leaveType: "cl", startDate: "2026-09-07", endDate: "2026-09-07", halfDay: true })).json();
    expect(half.days).toBe(0.5);
    // Half days apply to Casual Leave only, and only to a single day.
    expect((await mk({ type: "leave", leaveType: "el", startDate: "2026-09-07", endDate: "2026-09-07", halfDay: true })).status()).toBe(400);
    expect((await mk({ type: "leave", leaveType: "cl", startDate: "2026-09-07", endDate: "2026-09-08", halfDay: true })).status()).toBe(400);

    // A leave type is required, and WFH draws from no balance.
    expect((await mk({ type: "leave", startDate: "2026-09-07", endDate: "2026-09-07" })).status()).toBe(400);
    const wfh = await (await mk({ type: "wfh", startDate: "2026-09-07", endDate: "2026-09-08" })).json();
    expect(wfh).toMatchObject({ leaveType: null, days: 0 });
  });

  test("leave balances are per identity and per type, and need a signed-in user", async () => {
    // Without a verified identity there's no entitlement to apply.
    const anon = await (await (await device()).get("/api/leave")).json();
    expect(anon.signedIn).toBe(false);
    expect(anon.ledger).toBeUndefined();

    const who = `ledger.${Date.now().toString(36)}@innovinlabs.com`;
    const ctx = await signedIn(who, "Ledger Person");
    const mine = await (await ctx.get("/api/leave")).json();
    expect(mine.signedIn).toBe(true);
    noRef(mine);
    // Not in the imported sheet, so the current policy applies: CL 4, SL 6, FL 2.
    const entitled = Object.fromEntries(mine.ledger.map((l: { type: string; entitled: number }) => [l.type, l.entitled]));
    expect(entitled).toMatchObject({ cl: 4, sl: 6, fl: 2 });
    expect(mine.earned.note).toContain("joining date"); // no joining date yet
    expect(mine.holidays).toHaveLength(10); // the declared 2026 list

    // Book 2 working days of Casual Leave: pending first, then used once approved.
    const req = await (
      await ctx.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: "2026-09-07", endDate: "2026-09-08" } })
    ).json();
    const cl = async () => (await (await ctx.get("/api/leave")).json()).ledger.find((l: { type: string }) => l.type === "cl");
    expect(await cl()).toMatchObject({ used: 0, pending: 2, remaining: 4 });

    const adm = await admin();
    await adm.patch("/api/away", { data: { id: req.id, status: "approved" } });
    expect(await cl()).toMatchObject({ used: 2, pending: 0, remaining: 2 });

    // Sick Leave is untouched by Casual Leave usage — the buckets are separate.
    const other = await (await (await signedIn(`ledger2.${Date.now().toString(36)}@innovinlabs.com`, "Ledger Two")).get("/api/leave")).json();
    expect(other.ledger.find((l: { type: string }) => l.type === "cl")).toMatchObject({ used: 0, remaining: 4 });
  });

  test("an admin records Zoho balances, which then drive what the employee sees", async () => {
    expect((await (await device()).get("/api/leave?scope=overview")).status()).toBe(401);

    const who = `zoho.${Date.now().toString(36)}@innovinlabs.com`;
    const ctx = await signedIn(who, "Zoho Person");
    // Before any snapshot: the signed policy's entitlements, flagged as app-only.
    const before = await (await ctx.get("/api/leave")).json();
    expect(before).toMatchObject({ source: "app-only", asOf: null });
    expect(before.ledger.find((l: { type: string }) => l.type === "cl")).toMatchObject({ entitled: 4, remaining: 4 });

    // An admin copies the figures from Zoho's Leave Summary.
    const adm = await admin();
    const saved = await adm.patch("/api/leave", { data: { email: who, available: { cl: 3.5, sl: 5, el: 21, fl: 1 } } });
    expect(saved.status()).toBe(200);

    const after = await (await ctx.get("/api/leave")).json();
    expect(after.source).toBe("zoho-snapshot");
    expect(after.asOf).toBeTruthy();
    const left = Object.fromEntries(after.ledger.map((l: { type: string; remaining: number }) => [l.type, l.remaining]));
    expect(left).toMatchObject({ cl: 3.5, sl: 5, el: 21, fl: 1 });

    // Requesting leave here comes off the snapshot.
    await ctx.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: "2026-11-02", endDate: "2026-11-02" } });
    const adm2 = await admin();
    const mine = await (await adm2.get("/api/away")).json();
    const req = mine.find((r: { email: string }) => r.email === who);
    await adm2.patch("/api/away", { data: { id: req.id, status: "approved" } });
    const used = await (await ctx.get("/api/leave")).json();
    expect(used.ledger.find((l: { type: string }) => l.type === "cl")).toMatchObject({ used: 1, remaining: 2.5 });

    // Validation: halves only, and unknown people are rejected.
    expect((await adm.patch("/api/leave", { data: { email: who, available: { cl: 1.25 } } })).status()).toBe(400);
    expect((await adm.patch("/api/leave", { data: { email: who, available: { cl: -1 } } })).status()).toBe(400);
    expect((await adm.patch("/api/leave", { data: { email: "ghost@innovinlabs.com", available: { cl: 1 } } })).status()).toBe(404);

    const overview = await (await adm.get("/api/leave?scope=overview")).json();
    expect(overview.people.find((p: { email: string }) => p.email === who).summary.source).toBe("zoho-snapshot");
    noRef(overview);
  });

  test("people directory exposes names and presence tags only to employees, never coords or refs", async () => {
    const who = `presence.${Date.now().toString(36)}@innovinlabs.com`; // firstName → "Presence"
    const ctx = await signedIn(who, "Presence");
    await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 12.9352, lng: 77.6241 } });

    const res = await (await ctx.get("/api/people")).json();
    const me = res.inToday.find((p: { name: string }) => p.name === "Presence");
    expect(me).toMatchObject({ name: "Presence", where: "office" });
    expect(me.since).toBeTruthy();
    const raw = JSON.stringify(res.inToday);
    expect(raw).not.toContain("77.62"); // raw coordinates never leave the server
    expect(me.email).toBe(who); // verified directory identities include their work email
    noRef(res);
    expect(Array.isArray(res.people)).toBe(true);
  });

  test("events: admin publishes, devices RSVP, nothing exposes internal refs", async () => {
    const ctx = await device();
    const adm = await admin();
    const title = `E2E screening ${Date.now().toString(36)}`;

    // Bad form payloads redirect back with a flash key — never a 500.
    const bad = await adm.post("/api/events", { form: { title, category: "gala", startsAt: "not-a-date" }, maxRedirects: 0 });
    expect(bad.status()).toBe(303);
    expect(bad.headers().location).toBe("/admin?tab=publish&done=invalid-event#events");

    const posted = await adm.post("/api/events", {
      form: { title, category: "sports", startsAt: "2026-12-25T17:00", location: "Common area", body: "details" },
      maxRedirects: 0,
    });
    expect(posted.headers().location).toBe("/admin?tab=publish&done=event-posted#events");

    const list = await (await ctx.get("/api/events")).json();
    const ev = list.find((e: { title: string }) => e.title === title);
    expect(ev).toMatchObject({ title, category: "sports", location: "Common area", going: 0, mine: false });
    expect(ev.startsAt).toBe("2026-12-25T11:30:00.000Z"); // 17:00 IST
    noRef(ev);
    expect(JSON.stringify(ev)).not.toContain("createdBy");

    // RSVP validation and toggle semantics.
    expect((await ctx.patch("/api/events", { data: "{bad", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
    expect((await ctx.patch("/api/events", { data: {} })).status()).toBe(400);
    expect((await ctx.patch("/api/events", { data: { eventId: "missing", going: true } })).status()).toBe(404);

    const on = await (await ctx.patch("/api/events", { data: { eventId: ev.id, going: true } })).json();
    expect(on).toEqual({ going: true, count: 1 });
    const other = await device();
    const otherOn = await (await other.patch("/api/events", { data: { eventId: ev.id, going: true } })).json();
    expect(otherOn).toEqual({ going: true, count: 2 });

    const mine = (await (await ctx.get("/api/events")).json()).find((e: { id: string }) => e.id === ev.id);
    expect(mine).toMatchObject({ going: 2, mine: true });
    const theirs = await (await (await device()).get("/api/events")).json();
    expect(theirs.find((e: { id: string }) => e.id === ev.id).mine).toBe(false);

    const off = await (await ctx.patch("/api/events", { data: { eventId: ev.id, going: false } })).json();
    expect(off).toEqual({ going: false, count: 1 });

    const del = await adm.post("/api/events", { form: { _action: "delete", id: ev.id }, maxRedirects: 0 });
    expect(del.headers().location).toBe("/admin?tab=publish&done=event-deleted#events");
    expect((await (await ctx.get("/api/events")).json()).find((e: { id: string }) => e.id === ev.id)).toBeUndefined();
  });

  test("grievances accept a compressed photo and return it to the device and admin", async () => {
    const ctx = await device();
    const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const g = await (await ctx.post("/api/grievances", { data: { body: "with photo", image: img } })).json();
    expect(g.image).toBe(img);
    const mine = await (await ctx.get("/api/grievances?scope=mine")).json();
    expect(mine.find((x: { id: string }) => x.id === g.id).image).toBe(img);
    const adm = await admin();
    const all = await (await adm.get("/api/grievances")).json();
    expect(all.find((x: { id: string }) => x.id === g.id).image).toBe(img);
  });

  test("speed test serves 2 MB of uncached bytes", async () => {
    const ctx = await device();
    const res = await ctx.get("/api/wifi/speedtest");
    expect(res.status()).toBe(200);
    expect((await res.body()).byteLength).toBe(2 * 1024 * 1024);
    expect(res.headers()["cache-control"]).toBe("no-store");
  });
});

test.describe("API: privacy & auth", () => {
  test("admin-only endpoints reject anonymous callers", async () => {
    const ctx = await device();
    expect((await ctx.get("/api/grievances")).status()).toBe(401);
    expect((await ctx.get("/api/away")).status()).toBe(401);
    expect((await ctx.patch("/api/grievances", { data: { id: "x", status: "resolved" } })).status()).toBe(401);
    expect((await ctx.patch("/api/away", { data: { id: "x", status: "approved" } })).status()).toBe(401);
    expect((await ctx.post("/api/announcements", { form: { title: "hack" } })).status()).toBe(401);
    expect((await ctx.post("/api/announcements", { form: { _action: "delete", id: "x" } })).status()).toBe(401);
    expect((await ctx.post("/api/events", { form: { title: "hack", category: "social", startsAt: "2026-12-01T17:00" } })).status()).toBe(401);
    expect((await ctx.post("/api/events", { form: { _action: "delete", id: "x" } })).status()).toBe(401);
  });

  test("anonymous grievances never expose submitter identity, to devices or admins", async () => {
    const mine = await device();
    const posted = await mine.post("/api/grievances", { data: { body: "private thing" } });
    // The device keeps the grievance id itself — the server stores no device link at all.
    expect(posted.headers()["set-cookie"]).toContain("innovin_grv=");
    const g = await posted.json();
    noRef(g);
    const list = await (await mine.get("/api/grievances?scope=mine")).json();
    expect(list.map((x: { id: string }) => x.id)).toContain(g.id);
    noRef(list);
    expect(await (await (await device()).get("/api/grievances?scope=mine")).json()).toEqual([]);

    const adm = await admin();
    const all = await (await adm.get("/api/grievances")).json();
    expect(all.find((x: { id: string }) => x.id === g.id)).toMatchObject({ displayName: null, status: "open" });
    noRef(all);
  });

  test("admin status updates validate input and report unknown ids", async () => {
    const adm = await admin();
    const g = await (await (await device()).post("/api/grievances", { data: { body: "status test" } })).json();
    expect((await adm.patch("/api/grievances", { data: { id: g.id, status: "closed" } })).status()).toBe(400);
    expect((await adm.patch("/api/grievances", { data: { id: "missing", status: "resolved" } })).status()).toBe(404);
    expect((await adm.patch("/api/grievances", { data: "{bad", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
    expect((await adm.patch("/api/grievances", { data: { id: g.id, status: "resolved" } })).status()).toBe(200);
  });

  test("announcement form posts redirect with flash keys", async () => {
    const adm = await admin();
    const empty = await adm.post("/api/announcements", { form: { title: "  " }, maxRedirects: 0 });
    expect(empty.status()).toBe(303);
    expect(empty.headers().location).toBe("/admin?tab=publish&done=missing-title#announcements");
    const posted = await adm.post("/api/announcements", { form: { title: "API notice" }, maxRedirects: 0 });
    expect(posted.headers().location).toBe("/admin?tab=publish&done=posted#announcements");
    const list = await (await adm.get("/api/announcements")).json();
    const created = list.find((a: { title: string }) => a.title === "API notice");
    expect(created).toMatchObject({ tag: "Office", body: "" });
    const del = await adm.post("/api/announcements", { form: { _action: "delete", id: created.id }, maxRedirects: 0 });
    expect(del.headers().location).toBe("/admin?tab=publish&done=deleted#announcements");
  });

  test("the retired shared-passcode login no longer exists", async () => {
    const ctx = await device();
    expect((await ctx.post("/api/admin/login", { data: { passcode: "1704" } })).status()).toBe(404);
    expect((await ctx.get("/api/grievances")).status()).toBe(401);
  });

  test("security headers are set on pages and APIs", async () => {
    const ctx = await device();
    for (const path of ["/", "/api/wifi"]) {
      const h = (await ctx.get(path)).headers();
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["x-powered-by"]).toBeUndefined();
    }
  });
});

test.describe("API: abuse limits", () => {
  test("grievance spam from one device is capped at 10 per hour, others unaffected", async () => {
    const spammer = await device();
    for (let i = 0; i < 10; i++) expect((await spammer.post("/api/grievances", { data: { body: `spam ${i}` } })).status()).toBe(200);
    expect((await spammer.post("/api/grievances", { data: { body: "one more" } })).status()).toBe(429);
    expect((await (await device()).post("/api/grievances", { data: { body: "legit" } })).status()).toBe(200);
  });

  test("speed test is capped per device", async () => {
    const ctx = await device();
    for (let i = 0; i < 10; i++) expect((await ctx.get("/api/wifi/speedtest")).status()).toBe(200);
    expect((await ctx.get("/api/wifi/speedtest")).status()).toBe(429);
  });
});
