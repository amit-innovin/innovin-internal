import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { MOCK_URL } from "./mock-url";
import { MAIN_URL } from "../playwright.config";
import { futureWorkday } from "./dates";
import { LEGACY_WFH, LEGACY_WFH_CANCEL } from "./legacy-wfh";

// HTTP-level verification of validation, auth, privacy, idempotency and abuse limits.
const FUTURE = futureWorkday();
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

// Like signedIn, but from a fixed IP, so tests can put two people behind one office address.
async function signedInFrom(who: string, fromIp: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: MAIN_URL, extraHTTPHeaders: { "x-forwarded-for": fromIp } });
  await ctx.get(`${MOCK_URL}/as?email=${encodeURIComponent(who)}&name=${encodeURIComponent(who)}`);
  expect((await ctx.get("/api/auth/google?next=/", { maxRedirects: 10 })).ok()).toBe(true);
  await ctx.get(`${MOCK_URL}/as?reset=1`);
  return ctx;
}

const noRef = (body: unknown) => expect(JSON.stringify(body)).not.toContain("submitterRef");

// A context signed in through the Google OAuth mock as a specific person, so per-identity
// features (leave balances) can be exercised. `/as` pins the mock's next identity.
async function signedIn(who: string, name = who): Promise<APIRequestContext> {
  const ctx = await device();
  await ctx.get(`${MOCK_URL}/as?email=${encodeURIComponent(who)}&name=${encodeURIComponent(name)}`);
  const res = await ctx.get("/api/auth/google?next=/", { maxRedirects: 10 });
  expect(res.ok()).toBe(true);
  await ctx.get(`${MOCK_URL}/as?reset=1`);
  return ctx;
}

async function officeDevice() {
  const ctx = await signedIn(email());
  expect((await ctx.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241, accuracyM: 20 } })).status()).toBe(200);
  return ctx;
}

test.describe("API: removed features", () => {
  for (const path of ["/api/pantry-shop", "/api/pantry-provider", "/api/pings", "/api/planner"]) {
    test(`removed API ${path} is gone`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }
});

test.describe("API: office days", () => {
  const isoDay = (offset: number) => {
    // The server works in IST; build the date the same way so the test holds around midnight.
    const d = new Date(Date.now() + 5.5 * 3600_000 + offset * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  test("needs a sign-in", async ({ request }) => {
    expect((await request.get("/api/days")).status()).toBe(401);
    expect((await request.post("/api/days", { data: { mode: "office" } })).status()).toBe(401);
    expect((await request.patch("/api/days/plan", { data: { date: FUTURE, planned: true } })).status()).toBe(401);
    expect((await request.patch("/api/days", { data: { officeDays: [0] } })).status()).toBe(401);
  });

  test("office needs proof: a location inside the office", async () => {
    const ctx = await signedIn(email());
    // No position: asked for a location.
    const ask = await ctx.post("/api/days", { data: { mode: "office" } });
    expect(ask.status()).toBe(428);
    expect((await ask.json()).code).toBe("location-needed");
    // A position far from the office is refused, and nothing is recorded.
    const far = await ctx.post("/api/days", { data: { mode: "office", lat: 12.99, lng: 77.7, accuracyM: 20 } });
    expect(far.status()).toBe(422);
    expect(await far.json()).toMatchObject({ code: "outside", error: "You don't look like you're at the office" });
    expect((await (await ctx.get("/api/days")).json()).me).toBeNull();
    // Inside the fake office (12.935,77.624 ±1km).
    const ok = await ctx.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241, accuracyM: 15 } });
    expect(ok.status()).toBe(200);
    const view = await ok.json();
    expect(view.me).toMatchObject({ mode: "office", source: "location" });
    expect(view.summary.done).toBe(1);
    // Coordinates never come back out.
    expect(JSON.stringify(view)).not.toContain("12.9352");

    // Being on the office network is not proof: without a position the check-in is refused.
    const wifi = await signedIn(email());
    const viaWifi = await wifi.post("/api/days", { data: { mode: "office" }, headers: { "x-forwarded-for": "203.0.113.7" } });
    expect(viaWifi.status()).toBe(428);
    expect(await viaWifi.json()).toMatchObject({ code: "location-needed" });
  });

  test("remote isn't a mark any more; office marks today and Change clears it", async () => {
    const ctx = await signedIn(email());
    expect((await ctx.post("/api/days", { data: { mode: "remote" } })).status()).toBe(400);
    const office = await (await ctx.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241 } })).json();
    expect(office.me.mode).toBe("office");
    expect(office.days.filter((d: { mode: string | null }) => d.mode).length).toBe(1);
    const cleared = await (await ctx.post("/api/days", { data: { mode: "none" } })).json();
    expect(cleared.me).toBeNull();
    expect(cleared.summary.done).toBe(0);
  });

  test("single future days can be planned and unplanned, up to two months ahead", async () => {
    const ctx = await signedIn(email());
    const plan = (date: string, planned: unknown) => ctx.patch("/api/days/plan", { data: { date, planned } });
    const day = (view: { days: { date: string; planned: boolean; added: boolean }[] }, date: string) => view.days.find((d) => d.date === date)!;
    const on = await plan(FUTURE, true);
    expect(on.status()).toBe(200);
    expect(day(await on.json(), FUTURE)).toMatchObject({ planned: true, added: true });
    expect(day(await (await plan(FUTURE, false)).json(), FUTURE).planned).toBe(false);

    const sunday = (() => { let d = isoDay(7); while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 0) d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10); return d; })();
    const [y, m] = isoDay(0).split("-").map(Number);
    const threeAhead = new Date(Date.UTC(y, m - 1 + 3, 10)).toISOString().slice(0, 10);
    for (const date of [isoDay(0), isoDay(-1), sunday, threeAhead]) {
      const res = await plan(date, true);
      expect(res.status(), date).toBe(409);
      expect(await res.json()).toMatchObject({ code: "not-plannable" });
    }
    expect((await plan(FUTURE, "yes")).status()).toBe(400);
    expect((await plan("2026-13-01", true)).status()).toBe(400);
  });

  test("the days view says nothing about who else is coming in", async () => {
    const ctx = await signedIn(email());
    const view = await (await ctx.get("/api/days")).json();
    expect(view.around.next).toBeUndefined();
  });

  test("a usual day is planned again once leave over it is cancelled", async () => {
    const ctx = await signedIn(email());
    const weekday = (new Date(`${FUTURE}T00:00:00Z`).getUTCDay() + 6) % 7;
    await ctx.patch("/api/days", { data: { officeDays: [weekday] } });
    const planned = async () => (await (await ctx.get(`/api/days?month=${FUTURE.slice(0, 7)}`)).json()).days.find((d: { date: string }) => d.date === FUTURE).planned;
    expect(await planned()).toBe(true);
    const leave = await (await ctx.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: FUTURE, endDate: FUTURE, halfDay: false, reason: "" } })).json();
    expect(await planned()).toBe(false);
    expect((await ctx.patch("/api/away", { data: { id: leave.id, status: "cancelled" } })).status()).toBe(200);
    expect(await planned()).toBe(true);
  });

  test("admins close a day: nobody can plan it or check in, and leave over it costs nothing", async () => {
    const adm = await admin();
    const member = await signedIn(email());
    const today = isoDay(0);
    const closedDay = futureWorkday(3);
    const close = (date: string, reason = "Maintenance") => adm.post("/api/admin/closed-days", { data: { date, reason } });
    expect((await member.get("/api/admin/closed-days")).status()).toBe(401);
    expect((await member.post("/api/admin/closed-days", { data: { date: closedDay, reason: "x" } })).status()).toBe(401);
    expect((await close(closedDay, "")).status()).toBe(400);
    expect((await close(isoDay(-1))).status()).toBe(409);
    try {
      expect((await close(closedDay)).status()).toBe(200);
      expect((await close(closedDay)).status()).toBe(409);
      const listed = await (await adm.get(`/api/admin/closed-days?from=${closedDay}&to=${closedDay}`)).json();
      expect(listed).toMatchObject([{ date: closedDay, reason: "Maintenance" }]);

      const plan = await member.patch("/api/days/plan", { data: { date: closedDay, planned: true } });
      expect(plan.status()).toBe(409);
      const view = await (await member.get(`/api/days?month=${closedDay.slice(0, 7)}`)).json();
      expect(view.days.find((d: { date: string }) => d.date === closedDay)).toMatchObject({ closed: "Maintenance", working: false, planned: false });

      // A two-day request over the closed day and the next working day costs one day.
      const next = new Date(Date.parse(`${closedDay}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      const leave = await member.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: closedDay, endDate: next, halfDay: false, reason: "" } });
      expect(leave.status()).toBe(200);
      expect((await leave.json()).days).toBe(1);

      expect((await close(today)).status()).toBe(200);
      const checkIn = await member.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241 } });
      expect(checkIn.status()).toBe(409);
      expect(await checkIn.json()).toMatchObject({ code: "closed", error: "The office is closed that day" });
    } finally {
      await adm.delete("/api/admin/closed-days", { data: { date: today } });
      await adm.delete("/api/admin/closed-days", { data: { date: closedDay } });
    }
    expect((await adm.delete("/api/admin/closed-days", { data: { date: closedDay } })).status()).toBe(404);
  });

  test("past days are fixed by admins, not by members; future days can't be marked", async () => {
    const ctx = await signedIn(email());
    for (const date of [isoDay(-2), isoDay(-8)]) {
      const res = await ctx.post("/api/days", { data: { mode: "office", date } });
      expect(res.status(), date).toBe(403);
      expect(await res.json()).toMatchObject({ code: "locked", error: "Ask an admin to fix a past day" });
    }
    expect((await ctx.post("/api/days", { data: { mode: "office", date: isoDay(1) } })).status()).toBe(409);
    expect((await ctx.post("/api/days", { data: { mode: "office", date: "2026-02-30" } })).status()).toBe(400);
    expect((await ctx.post("/api/days", { data: { mode: "desk" } })).status()).toBe(400);
  });

  test("office days are yours to set, and plan your future working days", async () => {
    const ctx = await signedIn(email());
    const start = await (await ctx.get("/api/days")).json();
    expect(start.officeDays).toEqual([]);
    expect(start.summary).toMatchObject({ target: 8, done: 0, toGo: 8 });
    // Every weekday: then they are certainly expected on the next working day.
    const set = await ctx.patch("/api/days", { data: { officeDays: [4, 0, 1, 2, 3, 5] } });
    expect(set.status()).toBe(200);
    const view = await set.json();
    expect(view.officeDays).toEqual([0, 1, 2, 3, 4, 5]);
    // Every future working day this month is now planned; nothing says who else is in.
    expect(view.days.filter((d: { date: string; working: boolean; planned: boolean }) => d.date > view.today && d.working).every((d: { planned: boolean }) => d.planned)).toBe(true);
    expect(view.around.next).toBeUndefined();
    for (const bad of [[7], [0, 0], "mon", [1.5]]) {
      expect((await ctx.patch("/api/days", { data: { officeDays: bad } })).status()).toBe(400);
    }
    expect((await ctx.get("/api/days?month=2026-13")).status()).toBe(400);
  });
});

test.describe("API: notifications", () => {
  test("signed-in notifications only carry the known kinds", async () => {
    const ctx = await signedIn(email());
    const res = await ctx.get("/api/notifications");
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const item of body.items) expect(["announcement", "event", "away", "grievance", "kudos", "tea"]).toContain(item.kind);
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
      [{ email: who, type: "wfh", startDate: "2026-10-07", endDate: "2026-10-07" }, 400],
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

  test("attendance GET exposes only the caller's own status: no headcount", async () => {
    const who = email();
    const ctx = await signedIn(who);
    await ctx.post("/api/attendance", { data: { email: who, action: "in" } });
    const mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.email).toBe(who);
    expect(mine.me.checkedIn).toBe(true);
    expect(mine.me.checkInAt).toBeTruthy();
    expect(mine.me.checkOutAt).toBeNull();
    // `office` (the geofence) is exposed on purpose — the client needs it to decide auto
    // check-in. Everyone else's sessions stay hidden.
    expect(Object.keys(mine).sort()).toEqual(["email", "me", "office"]);

    const stranger = await (await (await signedIn(email())).get("/api/attendance")).json();
    expect(stranger.count).toBeUndefined();
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
    expect(start.headers()["location"]).toContain(`${MOCK_URL.replace("http://", "")}/auth`);
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
      await ctx.post("/api/away", { data: { email: "forged@innovinlabs.com", type: "leave", leaveType: "cl", startDate: FUTURE, endDate: FUTURE } })
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
    const created = await (await ctx.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: FUTURE, endDate: FUTURE, reason: "private reason" } })).json();
    const secondDevice = await signedIn(who);
    expect((await (await secondDevice.get("/api/away?scope=mine")).json()).some((r: { id: string }) => r.id === created.id)).toBe(true);
    await ctx.post("/api/auth/logout");
    expect((await ctx.get("/api/away?scope=mine")).status()).toBe(401);
    expect((await ctx.patch("/api/away", { data: { id: created.id, status: "cancelled" } })).status()).toBe(403);
    await ctx.get(`${MOCK_URL}/as?email=${encodeURIComponent(email())}`);
    try { await ctx.get("/api/auth/google?next=/"); }
    finally { await ctx.get(`${MOCK_URL}/as?reset=1`); }
    expect((await (await ctx.get("/api/away?scope=mine")).json()).some((r: { id: string }) => r.id === created.id)).toBe(false);
    expect((await ctx.patch("/api/away", { data: { id: created.id, status: "cancelled" } })).status()).toBe(403);
    expect((await secondDevice.patch("/api/away", { data: { id: created.id, status: "cancelled" } })).status()).toBe(200);
  });

  test("WFH requests are rejected; leave still works", async () => {
    const ctx = await signedIn(email());
    const wfh = await ctx.post("/api/away", { data: { type: "wfh", startDate: FUTURE, endDate: FUTURE, reason: "x" } });
    expect(wfh.status()).toBe(400);
    expect((await wfh.json()).error).toBe("WFH requests are gone — just tap Remote on Home");
    const leave = await ctx.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: FUTURE, endDate: FUTURE, reason: "x" } });
    expect(leave.status()).toBe(200);
  });

  // The row is written straight into the JSON data file by e2e/global-setup.ts: the API refuses
  // to create one now, but rows from before the cut still exist in real stores.
  test("a pre-cut pending WFH row is history for its owner, not work for the admin", async () => {
    test.skip(!!process.env.E2E_DATABASE_URL, "the legacy row is seeded into the JSON data file only");
    const owner = await signedIn(LEGACY_WFH.email);
    const adm = await admin();

    const mine = await (await owner.get("/api/away?scope=mine")).json();
    expect(mine.find((r: { id: string }) => r.id === LEGACY_WFH.id)).toMatchObject({ type: "wfh", status: "pending" });

    const queue = await (await adm.get("/api/away?scope=pending")).json();
    expect(queue.map((r: { id: string }) => r.id)).not.toContain(LEGACY_WFH.id);

    // Leave is approved in Zoho People, so admins get no "awaiting review" items at all,
    // for a pending leave request or for the old WFH row.
    const who = email();
    const control = await (await (await signedIn(who)).post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: FUTURE, endDate: FUTURE } })).json();
    const feed = await (await adm.get("/api/notifications")).json();
    const ids = feed.items.map((i: { id: string }) => i.id);
    expect(ids.filter((id: string) => id.startsWith("pending-away-"))).toEqual([]);
    expect((await adm.patch("/api/away", { data: { id: control.id, status: "cancelled" } })).status()).toBe(200);

    for (const status of ["approved", "rejected"]) {
      const res = await adm.patch("/api/away", { data: { id: LEGACY_WFH.id, status } });
      expect(res.status()).toBe(409);
      expect((await res.json()).error).toBe("WFH requests no longer need approval");
    }
  });

  test("the owner can still cancel their own pending WFH row", async () => {
    test.skip(!!process.env.E2E_DATABASE_URL, "the legacy row is seeded into the JSON data file only");
    const owner = await signedIn(LEGACY_WFH_CANCEL.email);
    expect((await owner.patch("/api/away", { data: { id: LEGACY_WFH_CANCEL.id, status: "cancelled" } })).status()).toBe(200);
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

    // A leave type is required.
    expect((await mk({ type: "leave", startDate: "2026-09-07", endDate: "2026-09-07" })).status()).toBe(400);
  });

  test("an approved leave can be cancelled only by its owner, and the days come back", async () => {
    const who = `cancel.${Date.now().toString(36)}@innovinlabs.com`;
    const ctx = await signedIn(who, "Cancel Person");
    const req = await (await ctx.post("/api/away", { data: { type: "leave", leaveType: "cl", startDate: FUTURE, endDate: FUTURE } })).json();
    const cl = async () => (await (await ctx.get("/api/leave")).json()).ledger.find((l: { type: string }) => l.type === "cl");
    const adm = await admin();
    expect((await adm.patch("/api/away", { data: { id: req.id, status: "approved" } })).status()).toBe(200);
    expect((await cl()).remaining).toBe(3);
    const stranger = await signedIn(`stranger.${Date.now().toString(36)}@innovinlabs.com`, "Stranger");
    expect((await stranger.patch("/api/away", { data: { id: req.id, status: "cancelled" } })).status()).toBe(403);
    expect((await ctx.patch("/api/away", { data: { id: req.id, status: "cancelled" } })).status()).toBe(200);
    expect((await cl()).remaining).toBe(4);
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

  test("the people directory (who's in, since when, where) is for admins only, never coords or refs", async () => {
    const who = `presence.${Date.now().toString(36)}@innovinlabs.com`; // firstName → "Presence"
    const ctx = await signedIn(who, "Presence");
    await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 12.9352, lng: 77.6241 } });
    // Members see colleagues in the office on Home (first names, from /api/days), not this.
    expect((await ctx.get("/api/people")).status()).toBe(401);

    const res = await (await (await admin()).get("/api/people")).json();
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
    expect(ev).toMatchObject({ title, category: "sports", location: "Common area", mine: false });
    expect(ev.going).toBeUndefined(); // headcounts are for admins only
    expect(ev.startsAt).toBe("2026-12-25T11:30:00.000Z"); // 17:00 IST
    noRef(ev);
    expect(JSON.stringify(ev)).not.toContain("createdBy");

    // RSVP validation and toggle semantics.
    expect((await ctx.patch("/api/events", { data: "{bad", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
    expect((await ctx.patch("/api/events", { data: {} })).status()).toBe(400);
    expect((await ctx.patch("/api/events", { data: { eventId: "missing", going: true } })).status()).toBe(404);

    const on = await (await ctx.patch("/api/events", { data: { eventId: ev.id, going: true } })).json();
    expect(on).toEqual({ going: true });
    const other = await device();
    const otherOn = await (await other.patch("/api/events", { data: { eventId: ev.id, going: true } })).json();
    expect(otherOn).toEqual({ going: true });
    expect((await (await adm.get("/api/events")).json()).find((e: { id: string }) => e.id === ev.id).going).toBe(2);

    const mine = (await (await ctx.get("/api/events")).json()).find((e: { id: string }) => e.id === ev.id);
    expect(mine).toMatchObject({ mine: true });
    const theirs = await (await (await device()).get("/api/events")).json();
    expect(theirs.find((e: { id: string }) => e.id === ev.id).mine).toBe(false);

    const off = await (await ctx.patch("/api/events", { data: { eventId: ev.id, going: false } })).json();
    expect(off).toEqual({ going: false });

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
  test("the office-days grid is for admins only, and checks the month", async () => {
    expect((await (await device()).get("/api/admin/team")).status()).toBe(401);
    expect((await (await signedIn(email())).get("/api/admin/team")).status()).toBe(401);
    const adm = await admin();
    expect((await adm.get("/api/admin/team?month=2026-13")).status()).toBe(400);
    expect((await adm.get("/api/admin/team?month=2999-01")).status()).toBe(400);
    const team = await (await adm.get("/api/admin/team")).json();
    expect(team.days.length).toBeGreaterThan(15);
    expect(JSON.stringify(team)).not.toMatch(/"(done|target|status|count)"/);
  });

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

test.describe("Feed catch-up", () => {
  const plusDays = (n: number) => new Date(Date.now() + 5.5 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);

  test("the seen watermark only moves forward", async () => {
    const ctx = await signedIn(email());
    const first = await (await ctx.get("/api/feed")).json();
    expect(typeof first.seenAt).toBe("string");
    expect(Array.isArray(first.newIds)).toBe(true);
    const later = new Date(Date.now() - 60_000).toISOString();
    expect((await ctx.post("/api/feed/seen", { data: { at: later } })).status()).toBe(200);
    expect((await ctx.post("/api/feed/seen", { data: { at: first.seenAt } })).status()).toBe(200);
    expect((await (await ctx.get("/api/feed")).json()).seenAt).toBe(later);
    expect((await ctx.post("/api/feed/seen", { data: { at: "yesterday" } })).status()).toBe(400);
  });

  test("poll results stay hidden until you vote", async () => {
    const author = await signedIn(email());
    const question = `Lunch? ${Date.now()}`;
    expect((await author.post("/api/notices", { data: { kind: "poll", title: question, options: ["Biryani", "Pizza"], closesOn: plusDays(3) } })).status()).toBe(201);
    const voter = await signedIn(email());
    const poll = async () => (await (await voter.get("/api/feed")).json()).posts.find((p: { question?: string }) => p.question === question);
    const before = await poll();
    expect(before.total).toBeNull();
    expect(before.options.every((o: { pct: number | null; votes: number | null }) => o.pct === null && o.votes === null)).toBe(true);
    await voter.patch("/api/notices", { data: { id: before.id, vote: 0 } });
    const after = await poll();
    expect(after.total).toBe(1);
    expect(after.options[0]).toMatchObject({ pct: 100, votes: 1, mine: true });
  });

  test("only admins publish events", async () => {
    const member = await signedIn(email());
    const startsAt = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
    expect((await member.post("/api/events", { data: { title: "Member event", category: "social", startsAt, body: "", location: "" } })).status()).toBe(401);
    const adm = await admin();
    expect((await adm.post("/api/events", { data: { title: `Admin event ${Date.now()}`, category: "social", startsAt, body: "", location: "" } })).status()).toBe(201);
  });

  test("an announcement's pin date can't be in the past", async () => {
    const adm = await admin();
    for (const pinnedUntil of [plusDays(-1)]) {
      const title = `Bad pin ${Date.now()} ${pinnedUntil}`;
      const res = await adm.post("/api/announcements", { form: { title, body: "", important: "on", pinnedUntil }, maxRedirects: 0 });
      expect(res.status()).toBe(303);
      expect(res.headers().location).toContain("done=bad-pin");
      expect((await (await adm.get("/api/announcements")).json()).some((a: { title: string }) => a.title === title)).toBe(false);
    }
  });

  test("reading the feed doesn't use up the office's shared write limit", async () => {
    // Two people behind one office IP: one reads a lot, the other can still vote.
    const shared = ip();
    const at = (who: string) => signedInFrom(who, shared);
    const reader = await at(email());
    for (let i = 0; i < 125; i++) await reader.post("/api/feed/seen", { data: { at: new Date(Date.now() - 3_600_000 + i * 1000).toISOString() } });
    const other = await at(email());
    const res = await other.post("/api/notices", { data: { kind: "quote", body: "Still works", title: "", attribution: "", color: "purple", anonymous: false } });
    expect(res.status()).toBe(201);
  });

  test("your own birthday isn't in your feed's celebrations", async () => {
    const who = email();
    const ctx = await signedIn(who);
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(5, 10);
    expect((await ctx.patch("/api/account", { data: { birthday: today, showBirthday: true } })).status()).toBe(200);
    const feed = await (await ctx.get("/api/feed")).json();
    expect(feed.celebrations.some((c: { email: string }) => c.email === who)).toBe(false);
  });

  test("an important announcement is shown once per person and admins see a count", async () => {
    const adm = await admin();
    const title = `Office closed ${Date.now()}`;
    expect((await adm.post("/api/announcements", { form: { title, body: "Maintenance", important: "on", pinnedUntil: plusDays(3) }, maxRedirects: 0 })).status()).toBe(303);
    const member = await signedIn(email());
    const shown = await (await member.get("/api/announcements/important")).json();
    expect(shown.announcement).toMatchObject({ title, body: "Maintenance", authorName: "Admin E2E" });
    const feed = await (await member.get("/api/feed")).json();
    expect(feed.newIds).not.toContain(shown.announcement.id);
    expect((await member.post("/api/announcements/ack", { data: { id: "missing" } })).status()).toBe(404);
    expect((await member.post("/api/announcements/ack", { data: { id: shown.announcement.id } })).status()).toBe(200);
    expect((await (await member.get("/api/announcements/important")).json()).announcement?.id).not.toBe(shown.announcement.id);
    const list = await (await adm.get("/api/announcements")).json();
    expect(list.find((a: { id: string }) => a.id === shown.announcement.id)).toMatchObject({ important: true, seen: 1 });
    await adm.post("/api/announcements", { form: { _action: "delete", id: shown.announcement.id }, maxRedirects: 0 });
  });
});

test.describe("Tea & snacks", () => {
  const DEFAULTS = { amAt: "11:00", amClose: "10:45", pmAt: "16:00", pmClose: "15:30", orderAt: "12:00" };
  // Checked in at the office today, by location (the only way in now).
  const inOffice = async () => {
    const ctx = await signedIn(email());
    expect((await ctx.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241, accuracyM: 20 } })).status()).toBe(200);
    return ctx;
  };
  const setTimes = async (adm: APIRequestContext, times: object) => adm.patch("/api/admin/snack-times", { data: { ...DEFAULTS, ...times } });

  test("tea and snack picks are for people checked in at the office", async () => {
    const ctx = await signedIn(email());
    const tea = await ctx.post("/api/tea", { data: { round: "am", going: true } });
    expect(tea.status()).toBe(403);
    expect(await tea.json()).toMatchObject({ code: "not-in-office" });
    const snacks = await (await ctx.get("/api/snacks")).json();
    const item = snacks.shelf[0];
    if (item) {
      const pick = await ctx.patch("/api/snacks", { data: { id: item.id, action: "pick" } });
      expect(pick.status()).toBe(403);
    }
  });

  test("one snack pick a day: switching moves it, and nobody sees who", async () => {
    const adm = await admin();
    const a = `Samosa ${Date.now()}`, b = `Fruit ${Date.now()}`;
    await adm.post("/api/snacks", { data: { name: a, shelf: true } });
    await adm.post("/api/snacks", { data: { name: b, shelf: true } });
    try {
      expect((await setTimes(adm, { orderAt: "23:59" })).status()).toBe(200);
      const ctx = await inOffice();
      const shelf = (await (await ctx.get("/api/snacks")).json()).shelf as { id: string; name: string }[];
      const idA = shelf.find((s) => s.name === a)!.id, idB = shelf.find((s) => s.name === b)!.id;
      // Counts go to admins only now; the member sees just which one is theirs.
      const count = async (id: string) => ((await (await adm.get("/api/snacks")).json()).today.picks as { itemId: string; count: number }[]).find((p) => p.itemId === id)?.count ?? 0;
      let view = await (await ctx.patch("/api/snacks", { data: { id: idA, action: "pick" } })).json();
      expect(view.today).toMatchObject({ open: true, mine: idA });
      expect(await count(idA)).toBe(1);
      view = await (await ctx.patch("/api/snacks", { data: { id: idB, action: "pick" } })).json();
      expect(view.today.mine).toBe(idB);
      expect([await count(idA), await count(idB)]).toEqual([0, 1]);
      expect(JSON.stringify(view)).not.toContain("voterRef");
      view = await (await ctx.patch("/api/snacks", { data: { id: idB, action: "unpick" } })).json();
      expect(view.today.mine).toBeNull();
    } finally {
      await setTimes(adm, {});
    }
  });

  test("tea is answered per round, and not after the round's answers close", async () => {
    const adm = await admin();
    try {
      // Morning round all day, answers open until 23:57.
      expect((await setTimes(adm, { amAt: "23:58", amClose: "23:57", pmAt: "23:59", pmClose: "23:58" })).status()).toBe(200);
      const ctx = await inOffice();
      let tea = await (await ctx.get("/api/tea")).json();
      expect(tea.round).toMatchObject({ id: "am", at: "23:58", open: true });
      tea = await (await ctx.post("/api/tea", { data: { round: "am", going: false } })).json();
      expect(tea.mine).toBe(false);
      tea = await (await ctx.post("/api/tea", { data: { round: "am", going: true } })).json();
      expect(tea.mine).toBe(true);
      expect(tea.names).toBeUndefined();
      expect((await ctx.post("/api/tea", { data: { round: "pm", going: true } })).status()).toBe(409);
      // Now the morning round's answers closed at 00:01.
      await setTimes(adm, { amAt: "23:58", amClose: "00:01", pmAt: "23:59", pmClose: "23:58" });
      const closed = await ctx.post("/api/tea", { data: { round: "am", going: false } });
      expect(closed.status()).toBe(409);
      expect(await closed.json()).toMatchObject({ code: "closed" });
      const adminView = await (await adm.get("/api/tea")).json();
      expect(adminView.counts.am).toBeGreaterThan(0);
      expect(Array.isArray(adminView.names.am)).toBe(true);
    } finally {
      await setTimes(adm, {});
    }
  });

  test("the admin overview counts the round that's on now", async () => {
    const adm = await admin();
    try {
      expect((await setTimes(adm, { amAt: "23:58", amClose: "23:57", pmAt: "23:59", pmClose: "23:58" })).status()).toBe(200);
      const ctx = await inOffice();
      expect((await ctx.post("/api/tea", { data: { round: "am", going: true } })).status()).toBe(200);
      const overview = await (await adm.get("/api/admin/overview")).json();
      expect(overview.tea).toMatchObject({ round: "am", at: "23:58", closesAt: "23:57" });
      expect(overview.tea.count).toBeGreaterThan(0);
    } finally {
      await setTimes(adm, {});
    }
  });

  test("admins set the times; answers must close before their round", async () => {
    const adm = await admin();
    const member = await signedIn(email());
    expect((await member.patch("/api/admin/snack-times", { data: DEFAULTS })).status()).toBe(401);
    expect((await setTimes(adm, { amClose: "11:00" })).status()).toBe(400);
    expect((await setTimes(adm, { orderAt: "noon" })).status()).toBe(400);
    expect(await (await adm.get("/api/admin/snack-times")).json()).toEqual(DEFAULTS);
  });
});

test.describe("Steps, Wi-Fi and notifications (Stage 5)", () => {
  const inOffice = async () => {
    const ctx = await signedIn(email());
    expect((await ctx.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241, accuracyM: 20 } })).status()).toBe(200);
    return ctx;
  };
  const whoAmI = async (ctx: APIRequestContext) => (await (await ctx.get("/api/account")).json()).email as string;

  test("steps add up through the day, within a limit per add", async () => {
    const ctx = await signedIn(email());
    expect((await ctx.post("/api/steps", { data: { add: 2500 } })).status()).toBe(200);
    const res = await (await ctx.post("/api/steps", { data: { add: 2500 } })).json();
    expect(res.steps).toBe(5000);
    expect((await ctx.post("/api/steps", { data: { add: 60_000 } })).status()).toBe(400);
    expect((await ctx.post("/api/steps", { data: { add: 0 } })).status()).toBe(400);
  });

  test("the step league only lists people who joined, and nudges stay inside it", async () => {
    const a = await signedIn(email()), b = await signedIn(email()), outsider = await signedIn(email());
    const [ea, eb, eo] = [await whoAmI(a), await whoAmI(b), await whoAmI(outsider)];
    for (const ctx of [a, b, outsider]) await ctx.post("/api/steps", { data: { add: 3000 } });
    expect((await a.post("/api/steps/league", { data: { on: true } })).status()).toBe(200);
    expect((await a.post("/api/steps/nudge", { data: { email: eb } })).status()).toBe(403);
    await b.post("/api/steps/league", { data: { on: true } });
    expect((await a.post("/api/steps/nudge", { data: { email: ea } })).status()).toBe(400);
    expect((await a.post("/api/steps/nudge", { data: { email: eb } })).status()).toBe(200);
    expect((await a.post("/api/steps/nudge", { data: { email: eb } })).status()).toBe(409);
    const view = await (await a.get("/api/steps")).json();
    expect(view.inLeague).toBe(true);
    expect(view.nudged).toContain(eb);
    const listed = JSON.stringify([view.league, view.board]);
    expect(listed).toContain(eb);
    expect(listed).not.toContain(eo);
    await a.post("/api/steps/league", { data: { on: false } });
    expect((await b.post("/api/steps/nudge", { data: { email: ea } })).status()).toBe(403);
    expect(JSON.stringify((await (await b.get("/api/steps")).json()).league)).not.toContain(ea);
  });

  test("a Wi-Fi report needs an office check-in, stays anonymous and is only visible to admins", async ({ request }) => {
    const remote = await signedIn(email());
    const res = await remote.post("/api/wifi", { data: { quality: "poor", downMbps: 3, upMbps: 1, area: "Pantry" } });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not-in-office" });
    const ctx = await inOffice();
    expect((await ctx.post("/api/wifi", { data: { quality: "poor", downMbps: 3, upMbps: 1, area: "Somewhere" } })).status()).toBe(400);
    const note = `Calls drop ${Date.now()}`;
    expect((await ctx.post("/api/wifi", { data: { quality: "poor", downMbps: 3, upMbps: 1, area: "Pantry", note } })).status()).toBe(200);
    expect((await request.get("/api/wifi")).status()).toBe(401);
    expect((await ctx.get("/api/wifi")).status()).toBe(401);
    const reports = await (await admin()).get("/api/wifi");
    expect(reports.status()).toBe(200);
    const row = (await reports.json()).find((r: { note: string }) => r.note === note);
    expect(row).toMatchObject({ quality: "poor", area: "Pantry" });
    expect(JSON.stringify(row)).not.toMatch(/@innovinlabs\.com|submitterRef/);
    expect((await ctx.get("/api/wifi/ping")).status()).toBe(204);
    expect((await ctx.post("/api/wifi/upload", { data: "x".repeat(10_000), headers: { "Content-Type": "application/octet-stream" } })).status()).toBe(204);
  });

  test("Home's In office today carries first names, never a headcount", async () => {
    const viewer = await signedIn(email());
    const days = await (await viewer.get("/api/days")).json();
    expect(Array.isArray(days.around.inToday.names)).toBe(true);
    expect(days.around.inToday.count).toBeUndefined();
  });

  test("steps of people outside the league reach nobody, through any endpoint", async () => {
    const member = await signedIn(email()), outsider = await signedIn(email()), viewer = await signedIn(email());
    const eo = await whoAmI(outsider);
    await outsider.post("/api/steps", { data: { add: 7000 } });
    await member.post("/api/steps", { data: { add: 5000 } });
    await member.post("/api/steps/league", { data: { on: true } });
    // Not on Home, and not to a league member either.
    expect(JSON.stringify(await (await viewer.get("/api/days")).json())).not.toContain(eo);
    expect(JSON.stringify(await (await member.get("/api/steps")).json())).not.toContain(eo);
    // Someone who hasn't joined sees no league at all, not even its members.
    const notJoined = await (await viewer.get("/api/steps")).json();
    expect(notJoined.inLeague).toBe(false);
    expect(notJoined.league).toBeNull();
    expect(notJoined.board).toEqual([]);
  });

  test("the tea reminder raises the badge even if you looked before checking in", async () => {
    const adm = await admin();
    const times = (t: object) => adm.patch("/api/admin/snack-times", { data: { amAt: "11:00", amClose: "10:45", pmAt: "16:00", pmClose: "15:30", orderAt: "12:00", ...t } });
    try {
      expect((await times({ amAt: "23:58", amClose: "23:57", pmAt: "23:59", pmClose: "23:58" })).status()).toBe(200);
      const ctx = await signedIn(email());
      expect((await ctx.post("/api/notifications")).status()).toBe(200);
      expect((await ctx.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241, accuracyM: 20 } })).status()).toBe(200);
      const feed = await (await ctx.get("/api/notifications")).json();
      expect(feed.items.some((i: { kind: string }) => i.kind === "tea")).toBe(true);
      expect(feed.unread).toBeGreaterThan(0);
    } finally {
      await times({});
    }
  });

  test("Wi-Fi checks from one office address don't share one limit", async () => {
    const shared = ip();
    const a = await signedInFrom(email(), shared), b = await signedInFrom(email(), shared);
    for (let i = 0; i < 155; i++) await a.post("/api/wifi/upload", { data: "x", headers: { "Content-Type": "application/octet-stream" } });
    expect((await b.post("/api/wifi/upload", { data: "x", headers: { "Content-Type": "application/octet-stream" } })).status()).toBe(204);
  });

  test("notifications tell you about kudos you got, not kudos between others", async () => {
    const me = await signedIn(email()), giver = await signedIn(email()), other = await signedIn(email());
    const mine = await whoAmI(me);
    const otherEmail = await whoAmI(other);
    expect((await giver.post("/api/notices", { data: { kind: "kudos", toEmail: mine, body: "Thanks for the help" } })).status()).toBe(201);
    expect((await giver.post("/api/notices", { data: { kind: "kudos", toEmail: otherEmail, body: "Not for you" } })).status()).toBe(201);
    const items = (await (await me.get("/api/notifications")).json()).items as { title: string; href: string }[];
    const kudos = items.filter((i) => /kudos/i.test(i.title));
    expect(kudos.length).toBe(1);
    expect(kudos[0]).toMatchObject({ href: "/feed" });
    expect(kudos[0].title).toMatch(/gave you kudos$/);
  });
});

test.describe("Speak up and Feed reports (Stage 6)", () => {
  test("a Speak up message keeps the day only and nothing about who sent it", async () => {
    const guest = await device();
    const body = `The pantry tap leaks ${Date.now()}`;
    const sent = await guest.post("/api/grievances", { data: { body, topic: "Facilities" } });
    expect(sent.status()).toBe(200);
    const row = await sent.json();
    expect(row.createdAt).toMatch(/T18:30:00\.000Z$|T00:00:00/); // midnight IST, no time of day
    expect(row.topic).toBe("Facilities");
    expect((await guest.post("/api/grievances", { data: { body: "x", topic: "Gossip" } })).status()).toBe(400);
    const adm = await admin();
    const list = await (await adm.get("/api/grievances")).json();
    const seen = list.find((g: { body: string }) => g.body === body);
    expect(JSON.stringify(seen)).not.toMatch(/submitterRef|@innovinlabs\.com/);
    expect((await adm.patch("/api/grievances", { data: { id: seen.id, reply: "Plumber booked for Friday" } })).status()).toBe(200);
    const mine = await (await guest.get("/api/grievances?scope=mine")).json();
    expect(mine.find((g: { id: string }) => g.id === seen.id)).toMatchObject({ topic: "Facilities", reply: "Plumber booked for Friday" });
    const other = await device();
    expect((await (await other.get("/api/grievances?scope=mine")).json()).some((g: { id: string }) => g.id === seen.id)).toBe(false);
  });

  test("a Feed post can be reported once per person, never your own, and admins see only counts", async () => {
    const author = await signedIn(email()), reader = await signedIn(email());
    const body = `A quote ${Date.now()}`;
    await author.post("/api/notices", { data: { kind: "quote", body, title: "", attribution: "", color: "purple", anonymous: false } });
    const post = (await (await reader.get("/api/feed")).json()).posts.find((p: { body?: string }) => p.body === body);
    expect((await reader.post("/api/notices/report", { data: { id: post.id } })).status()).toBe(200);
    expect((await reader.post("/api/notices/report", { data: { id: post.id } })).status()).toBe(409);
    expect((await author.post("/api/notices/report", { data: { id: post.id } })).status()).toBe(400);
    expect((await reader.post("/api/notices/report", { data: { id: "missing" } })).status()).toBe(404);
    expect((await reader.get("/api/admin/reported")).status()).toBe(401);
    const reported = await (await (await admin()).get("/api/admin/reported")).json();
    const item = reported.find((r: { id: string }) => r.id === post.id);
    expect(item).toMatchObject({ reports: 1 });
    // The post's own author shows (it's a public post); nothing about who reported it does.
    const readerEmail = (await (await reader.get("/api/account")).json()).email;
    expect(JSON.stringify(item)).not.toContain(readerEmail);
    expect(JSON.stringify(item)).not.toMatch(/reporter/i);
  });
});

test.describe("Say hi (Stage 7)", () => {
  const person = async (opts: { on?: boolean; office?: boolean } = {}) => {
    const ctx = await signedIn(email());
    if (opts.office !== false) expect((await ctx.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241, accuracyM: 20 } })).status()).toBe(200);
    if (opts.on !== false) expect((await ctx.post("/api/hi/setting", { data: { on: true } })).status()).toBe(200);
    const me = (await (await ctx.get("/api/account")).json()).email as string;
    return { ctx, email: me };
  };
  const hi = (from: APIRequestContext, to: string, kind: string, time?: string) => from.post("/api/hi", { data: { to, kind, time } });

  test("waves need both people opted in and in the office, and stop at 3 a day", async () => {
    const a = await person(), b = await person(), c = await person(), d = await person();
    const off = await person({ on: false }), remote = await person({ office: false });
    expect((await hi(a.ctx, off.email, "wave")).status()).toBe(403);
    expect((await hi(a.ctx, remote.email, "wave")).status()).toBe(403);
    expect((await hi(a.ctx, a.email, "wave")).status()).toBe(400);
    expect((await hi(a.ctx, b.email, "dance")).status()).toBe(400);
    expect((await hi(a.ctx, b.email, "chai")).status()).toBe(400); // an invite needs a time
    expect((await hi(a.ctx, b.email, "lunch", "23:00")).status()).toBe(400); // 9:00–19:00 only
    for (const to of [b, c, d]) expect((await hi(a.ctx, to.email, "wave")).status()).toBe(200);
    const fourth = await hi(a.ctx, b.email, "five");
    expect(fourth.status()).toBe(409);
    const view = await (await a.ctx.get("/api/days")).json();
    expect(view.sayHi).toBe(true);
    expect(Object.keys(view.sent).sort()).toEqual([b.email, c.email, d.email].sort());
  });

  test("an invite is answered once, by its recipient, and the sender sees the answer", async () => {
    const a = await person(), b = await person(), c = await person();
    const sent = await (await hi(a.ctx, b.email, "chai", "now")).json();
    const received = (await (await b.ctx.get("/api/notifications")).json()).items.find((i: { id: string }) => i.id === `hi-${sent.id}`);
    expect(received).toMatchObject({ kind: "hi" });
    expect(received.title).toMatch(/: chai break now\?$/);
    expect((await c.ctx.post("/api/hi/reply", { data: { id: sent.id, reply: "yes" } })).status()).toBe(409);
    expect((await b.ctx.post("/api/hi/reply", { data: { id: sent.id, reply: "yes" } })).status()).toBe(200);
    expect((await b.ctx.post("/api/hi/reply", { data: { id: sent.id, reply: "no" } })).status()).toBe(409);
    const back = (await (await a.ctx.get("/api/notifications")).json()).items.find((i: { id: string }) => i.id === `hi-reply-${sent.id}`);
    expect(back.title).toMatch(/ is in for chai$/);
    const wave = await (await hi(a.ctx, c.email, "wave")).json();
    expect((await c.ctx.post("/api/hi/reply", { data: { id: wave.id, reply: "yes" } })).status()).toBe(409);
  });

  test("one hi per person a day, invites only for later today, and replies count as unread", async () => {
    const a = await person(), b = await person();
    expect((await hi(a.ctx, b.email, "wave")).status()).toBe(200);
    const again = await hi(a.ctx, b.email, "thanks");
    expect(again.status()).toBe(409);
    expect(await again.json()).toMatchObject({ code: "already" });
    const c = await person();
    const istNow = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(11, 16);
    if (istNow > "09:00") expect((await hi(a.ctx, c.email, "lunch", "09:00")).status()).toBe(400); // already past today
    const invite = await (await hi(a.ctx, c.email, "chai", "now")).json();
    expect((await a.ctx.post("/api/notifications")).status()).toBe(200); // the sender looks first
    await c.ctx.post("/api/hi/reply", { data: { id: invite.id, reply: "yes" } });
    const feed = await (await a.ctx.get("/api/notifications")).json();
    expect(feed.items.some((i: { id: string }) => i.id === `hi-reply-${invite.id}`)).toBe(true);
    expect(feed.unread).toBeGreaterThan(0);
  });

  test("who's in, with emails, only reaches people who can wave", async () => {
    const a = await person();
    const lurker = await person({ on: false });
    const remote = await person({ office: false });
    for (const viewer of [lurker, remote]) {
      const view = await (await viewer.ctx.get("/api/days")).json();
      expect(view.around.inToday.people).toEqual([]);
      expect(JSON.stringify(view.around)).not.toContain(a.email);
    }
  });

  test("turning Say hi off takes you out of everyone's options at once", async () => {
    const a = await person(), b = await person();
    const listed = async () => (await (await a.ctx.get("/api/days")).json()).around.inToday.people.find((p: { email: string }) => p.email === b.email);
    expect((await listed()).sayHi).toBe(true);
    await b.ctx.post("/api/hi/setting", { data: { on: false } });
    expect((await listed()).sayHi).toBe(false);
    expect((await hi(a.ctx, b.email, "wave")).status()).toBe(403);
  });
});

test.describe("Admin app (Stage 8a)", () => {
  test("Keep clears a post's reports but keeps the post; members can't", async () => {
    const author = await signedIn(email()), reader = await signedIn(email());
    const body = `Keep me ${Date.now()}`;
    await author.post("/api/notices", { data: { kind: "quote", body, title: "", attribution: "", color: "purple", anonymous: false } });
    const post = (await (await reader.get("/api/feed")).json()).posts.find((p: { body?: string }) => p.body === body);
    await reader.post("/api/notices/report", { data: { id: post.id } });
    expect((await reader.delete("/api/admin/reported", { data: { id: post.id } })).status()).toBe(401);
    const adm = await admin();
    expect((await adm.delete("/api/admin/reported", { data: { id: post.id } })).status()).toBe(200);
    expect((await (await adm.get("/api/admin/reported")).json()).some((r: { id: string }) => r.id === post.id)).toBe(false);
    expect((await (await reader.get("/api/feed")).json()).posts.some((p: { id: string }) => p.id === post.id)).toBe(true);
  });

  test("admins enter birthdays (day and month only)", async () => {
    const person = await signedIn(email());
    const who = (await (await person.get("/api/account")).json()).email;
    const adm = await admin();
    expect((await adm.patch("/api/people", { data: { email: who, birthday: "02-30", showBirthday: true } })).status()).toBe(400);
    expect((await adm.patch("/api/people", { data: { email: who, birthday: "11-18", showBirthday: true } })).status()).toBe(200);
    expect(await (await person.get("/api/account")).json()).toMatchObject({ birthday: "11-18", showBirthday: true });
  });

  test("every announcement reaches people once as a dialog, pinned or not", async () => {
    const adm = await admin();
    const title = `Plain notice ${Date.now()}`;
    expect((await adm.post("/api/announcements", { form: { title, body: "Water off at 3" }, maxRedirects: 0 })).status()).toBe(303);
    const member = await signedIn(email());
    let next = (await (await member.get("/api/announcements/important")).json()).announcement;
    // Older unacknowledged ones (from other tests) come first; acknowledge until ours shows.
    for (let i = 0; i < 20 && next && next.title !== title; i++) {
      await member.post("/api/announcements/ack", { data: { id: next.id } });
      next = (await (await member.get("/api/announcements/important")).json()).announcement;
    }
    expect(next?.title).toBe(title);
    await member.post("/api/announcements/ack", { data: { id: next.id } });
    const list = await (await adm.get("/api/announcements")).json();
    expect(list.find((a: { title: string }) => a.title === title)).toMatchObject({ seen: 1 });
    await adm.post("/api/announcements", { form: { _action: "delete", id: next.id }, maxRedirects: 0 });
  });

  test("members don't get vanity numbers: no going counts on events, no pick counts on snacks", async () => {
    const member = await signedIn(email());
    const feed = await (await member.get("/api/feed")).json();
    for (const p of feed.posts.filter((p: { type: string }) => p.type === "event")) expect(p.going).toBeUndefined();
    const snacks = await (await member.get("/api/snacks")).json();
    expect(snacks.today.picks).toBeUndefined();
    expect(snacks.shelf.every((s: { votes?: number }) => s.votes === undefined)).toBe(true);
  });
});
