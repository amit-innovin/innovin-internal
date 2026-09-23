import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { CLOSED_URL, MAIN_URL } from "../playwright.config";

// HTTP-level verification of validation, auth, privacy, idempotency and abuse limits.
let seq = 0;
const ip = () => `203.0.113.${(++seq % 250) + 1}-${Date.now()}`;
const email = () => `api.${Date.now().toString(36)}${++seq}@innovinlabs.com`;

async function device(baseURL = MAIN_URL, headers: Record<string, string> = {}) {
  return request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip(), ...headers } });
}

async function admin(): Promise<APIRequestContext> {
  const ctx = await device();
  const res = await ctx.post("/api/admin/login", { data: { passcode: "1704" } });
  expect(res.status()).toBe(200);
  return ctx;
}

const noRef = (body: unknown) => expect(JSON.stringify(body)).not.toContain("submitterRef");

test.describe("API: input validation", () => {
  test("malformed or non-object JSON bodies return 400, never 500", async () => {
    const ctx = await device();
    for (const path of ["/api/attendance", "/api/snacks", "/api/grievances", "/api/wifi"]) {
      for (const body of ["{bad", "[1,2]", "null", '"text"']) {
        const res = await ctx.post(path, { data: body, headers: { "Content-Type": "application/json" } });
        expect(res.status(), `${path} ${body}`).toBe(400);
      }
    }
    const login = await ctx.post("/api/admin/login", { data: "{bad", headers: { "Content-Type": "application/json" } });
    expect(login.status()).toBe(401);
  });

  test("attendance validates email, domain, and action", async () => {
    const ctx = await device();
    const cases: [unknown, number][] = [
      [{ email: "nope", action: "in" }, 400],
      [{ email: 42, action: "in" }, 400],
      [{ email: "a@gmail.com", action: "in" }, 403],
      [{ email: "A@INNOVINLABS.COM.evil.com", action: "in" }, 403],
      [{ email: email(), action: "dance" }, 400],
      [{ email: email(), action: "out" }, 404],
    ];
    for (const [data, status] of cases) expect((await ctx.post("/api/attendance", { data })).status(), JSON.stringify(data)).toBe(status);
  });

  test("snacks, wifi, and grievances reject invalid payloads", async () => {
    const ctx = await device();
    expect((await ctx.post("/api/snacks", { data: { items: ["caviar"] } })).status()).toBe(400);
    expect((await ctx.post("/api/snacks", { data: { items: [] } })).status()).toBe(400);
    expect((await ctx.post("/api/snacks", { data: { items: ["tea"], preference: "spicy" } })).status()).toBe(400);
    expect((await ctx.post("/api/snacks", { data: { itemId: "tea" } })).status()).toBe(400);
    expect((await ctx.post("/api/wifi", { data: { quality: "meh" } })).status()).toBe(400);
    expect((await ctx.post("/api/wifi", { data: { quality: "good", downMbps: -1 } })).status()).toBe(400);
    expect((await ctx.post("/api/wifi", { data: { quality: "good", downMbps: "fast" } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: "   " } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: 123 } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: "x", image: "data:text/html;base64,PGI+" } })).status()).toBe(400);
    expect((await ctx.post("/api/grievances", { data: { body: "x", image: "not-a-data-url" } })).status()).toBe(400);
    expect((await ctx.delete("/api/snacks")).status()).toBe(404);
  });

  test("long inputs are truncated server-side", async () => {
    const ctx = await device();
    const g = await (await ctx.post("/api/grievances", { data: { body: "x".repeat(5000), displayName: "n".repeat(500) } })).json();
    expect(g.body).toHaveLength(2000);
    expect(g.displayName).toHaveLength(100);
    const o = await (await ctx.post("/api/snacks", { data: { items: ["tea"], instructions: "i".repeat(900) } })).json();
    expect(o.items[0].instructions).toHaveLength(500);
  });
});

test.describe("API: behaviour", () => {
  test("check-in/out cycles: repeat check-in returns the open session, checkout starts a new one", async () => {
    const ctx = await device();
    const who = email();
    const first = await (await ctx.post("/api/attendance", { data: { email: who, action: "in" } })).json();
    const again = await (await ctx.post("/api/attendance", { data: { email: ` ${who.toUpperCase()} `, action: "in" } })).json();
    expect(again.id).toBe(first.id);
    const out = await (await ctx.post("/api/attendance", { data: { email: who, action: "out" } })).json();
    expect(out.id).toBe(first.id);
    expect(out.checkOutAt).toBeTruthy();
    // No open session now — a second checkout is refused, and a new check-in starts a new session.
    expect((await ctx.post("/api/attendance", { data: { email: who, action: "out" } })).status()).toBe(404);
    const second = await (await ctx.post("/api/attendance", { data: { email: who, action: "in" } })).json();
    expect(second.id).not.toBe(first.id);
    const mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.me.sessions).toHaveLength(2);
    expect(mine.me.checkedIn).toBe(true);
  });

  test("attendance GET exposes only the count and the caller's own status", async () => {
    const ctx = await device();
    const who = email();
    await ctx.post("/api/attendance", { data: { email: who, action: "in" } });
    const mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.email).toBe(who);
    expect(mine.me.checkedIn).toBe(true);
    expect(mine.me.sessions[0].checkInAt).toBeTruthy();
    expect(mine.me.totalMinutes).toBeGreaterThanOrEqual(0);
    expect(Object.keys(mine).sort()).toEqual(["count", "email", "me"]);

    const stranger = await (await (await device()).get("/api/attendance")).json();
    expect(stranger).toEqual({ count: mine.count, email: null, me: null });
  });

  test("check-in coordinates are classified against the office geofence, raw coords never returned", async () => {
    const ctx = await device();
    const who = email();
    // Inside the configured fake office (12.935,77.624 ±1km).
    await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 12.9352, lng: 77.6241, accuracyM: 15 } });
    let mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.me.location).toBe("office");
    expect(mine.me.sessions[0].location).toBe("office");
    expect(JSON.stringify(mine)).not.toContain("77.62");

    // A new session from far away is remote; invalid coords are rejected.
    await ctx.post("/api/attendance", { data: { email: who, action: "out" } });
    await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 13.05, lng: 77.6 } });
    mine = await (await ctx.get("/api/attendance")).json();
    expect(mine.me.location).toBe("remote");
    expect(mine.me.sessions[0].location).toBe("office");
    expect(mine.me.sessions[1].location).toBe("remote");
    expect((await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 200, lng: 0 } })).status()).toBe(400);
    expect((await ctx.post("/api/attendance", { data: { email: who, action: "in", lat: 12.9 } })).status()).toBe(400);
  });

  test("a day's order can hold several items, is replaceable and cancellable", async () => {
    const ctx = await device();
    const placed = await (await ctx.post("/api/snacks", { data: { items: ["tea", "lunch"], instructions: "i" } })).json();
    expect(placed.items).toHaveLength(2);
    noRef(placed);
    await ctx.post("/api/snacks", { data: { items: ["healthy"], preference: "healthy" } });
    const mine = await (await ctx.get("/api/snacks?scope=mine")).json();
    expect(mine).toMatchObject({ open: true, cutoffHour: 24 });
    expect(mine.items.map((o: { itemId: string }) => o.itemId)).toEqual(["healthy"]);
    noRef(mine);
    expect(await (await ctx.get("/api/snacks?scope=history")).json()).toHaveLength(1);
    expect((await ctx.delete("/api/snacks")).status()).toBe(200);
    expect((await (await ctx.get("/api/snacks?scope=mine")).json()).items).toEqual([]);

    const other = await device();
    expect((await (await other.get("/api/snacks?scope=mine")).json()).items).toEqual([]);
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

  test("after the cutoff, ordering and cancelling are refused", async () => {
    const ctx = await device(CLOSED_URL);
    expect((await (await ctx.get("/api/snacks?scope=mine")).json()).open).toBe(false);
    expect((await ctx.post("/api/snacks", { data: { items: ["tea"] } })).status()).toBe(403);
    expect((await ctx.delete("/api/snacks")).status()).toBe(403);
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
    expect((await ctx.get("/api/snacks")).status()).toBe(401);
    expect((await ctx.patch("/api/grievances", { data: { id: "x", status: "resolved" } })).status()).toBe(401);
    expect((await ctx.post("/api/announcements", { form: { title: "hack" } })).status()).toBe(401);
    expect((await ctx.post("/api/announcements", { form: { _action: "delete", id: "x" } })).status()).toBe(401);
  });

  test("anonymous grievances never expose submitter identity, to devices or admins", async () => {
    const mine = await device();
    const g = await (await mine.post("/api/grievances", { data: { body: "private thing" } })).json();
    noRef(g);
    const list = await (await mine.get("/api/grievances?scope=mine")).json();
    expect(list.map((x: { id: string }) => x.id)).toContain(g.id);
    noRef(list);
    expect(await (await (await device()).get("/api/grievances?scope=mine")).json()).toEqual([]);

    const adm = await admin();
    const all = await (await adm.get("/api/grievances")).json();
    expect(all.find((x: { id: string }) => x.id === g.id)).toMatchObject({ displayName: null, status: "open" });
    noRef(all);
    noRef(await (await adm.get("/api/snacks")).json());
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
    expect(empty.headers().location).toBe("/admin?done=missing-title#announcements");
    const posted = await adm.post("/api/announcements", { form: { title: "API notice" }, maxRedirects: 0 });
    expect(posted.headers().location).toBe("/admin?done=posted#announcements");
    const list = await (await adm.get("/api/announcements")).json();
    const created = list.find((a: { title: string }) => a.title === "API notice");
    expect(created).toMatchObject({ tag: "Office", body: "" });
    const del = await adm.post("/api/announcements", { form: { _action: "delete", id: created.id }, maxRedirects: 0 });
    expect(del.headers().location).toBe("/admin?done=deleted#announcements");
  });

  test("session cookie is HttpOnly, SameSite=Lax, 12h, and logout clears it", async () => {
    const ctx = await device();
    const res = await ctx.post("/api/admin/login", { data: { passcode: "1704" } });
    const setCookie = res.headers()["set-cookie"];
    expect(setCookie).toMatch(/innovin_admin=\d+\.[0-9a-f]{64}/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Max-Age=43200/);
    expect((await ctx.get("/api/grievances")).status()).toBe(200);
    const out = await ctx.post("/api/admin/logout", { maxRedirects: 0 });
    expect(out.status()).toBe(303);
    expect((await ctx.get("/api/grievances")).status()).toBe(401);
  });

  test("HTML form login works without JavaScript", async () => {
    const ctx = await device();
    const bad = await ctx.post("/api/admin/login", { form: { passcode: "0000" }, maxRedirects: 0 });
    expect(bad.headers().location).toBe("/admin?error=1");
    const good = await ctx.post("/api/admin/login", { form: { passcode: "1704" }, maxRedirects: 0 });
    expect(good.headers().location).toBe("/admin");
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
  test("admin PIN brute force locks the IP after 5 failures — even the right PIN", async () => {
    const attacker = await device();
    for (let i = 0; i < 5; i++) expect((await attacker.post("/api/admin/login", { data: { passcode: `99${i}0` } })).status()).toBe(401);
    const locked = await attacker.post("/api/admin/login", { data: { passcode: "1704" } });
    expect(locked.status()).toBe(429);
    expect(Number(locked.headers()["retry-after"])).toBeGreaterThan(0);
    // Other IPs are unaffected.
    expect((await (await device()).post("/api/admin/login", { data: { passcode: "1704" } })).status()).toBe(200);
  });

  test("a successful login clears earlier failures for that IP", async () => {
    const ctx = await device();
    for (let i = 0; i < 4; i++) await ctx.post("/api/admin/login", { data: { passcode: "0000" } });
    expect((await ctx.post("/api/admin/login", { data: { passcode: "1704" } })).status()).toBe(200);
    for (let i = 0; i < 4; i++) expect((await ctx.post("/api/admin/login", { data: { passcode: "0000" } })).status()).toBe(401);
  });

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
