import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOauthState, createUserSession, sanitizeNext, verifyOauthState, verifyUserSession } from "@/lib/auth";
import { adminEmails, allowedEmailDomains } from "@/lib/config";
import { clientIp, readJSON } from "@/lib/http";
import { distanceM, locationTag, officeLocation } from "@/lib/geo";
import { pgConfig } from "@/lib/pgconfig";
import { hit, peek, reset, resetAll } from "@/lib/rate-limit";
import { istHour, todayIST, validDate } from "@/lib/time";

const post = (body: string) => new Request("http://x/api", { method: "POST", body, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("validDate", () => {
  it("accepts real ISO calendar dates and rejects impossible or non-ISO ones", () => {
    expect(validDate("2026-11-10")).toBe(true);
    expect(validDate("2028-02-29")).toBe(true);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("10-11-2026")).toBe(false);
    expect(validDate("2026-10-15-extra")).toBe(false);
  });
});

describe("IST time", () => {
  it("rolls the office day over at IST midnight, not UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T18:29:00.000Z")); // 23:59 IST on the 22nd
    expect(todayIST()).toBe("2026-09-22");
    expect(istHour()).toBe(23);
    vi.setSystemTime(new Date("2026-09-22T18:31:00.000Z")); // 00:01 IST on the 23rd
    expect(todayIST()).toBe("2026-09-23");
    expect(istHour()).toBe(0);
  });
});

describe("config", () => {
  it("normalises allowed email domains", () => {
    expect(allowedEmailDomains()).toEqual(["innovinlabs.com"]);
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", " InnovinLabs.com , partner.io ,");
    expect(allowedEmailDomains()).toEqual(["innovinlabs.com", "partner.io"]);
  });
});

describe("office geofence", () => {
  it("is unset without OFFICE_LAT/OFFICE_LNG, so nothing is classified", () => {
    expect(officeLocation()).toBeNull();
    expect(locationTag(12.9, 77.6)).toBe("unknown");
    expect(locationTag(null, null)).toBe("unknown");
  });

  it("classifies inside/outside the radius, rejects bad config", () => {
    vi.stubEnv("OFFICE_LAT", "12.935");
    vi.stubEnv("OFFICE_LNG", "77.624");
    vi.stubEnv("OFFICE_RADIUS_M", "500");
    expect(officeLocation()).toEqual({ lat: 12.935, lng: 77.624, radiusM: 500 });
    expect(locationTag(12.935, 77.624)).toBe("office");
    expect(locationTag(12.9365, 77.6245)).toBe("office"); // ~170m away
    expect(locationTag(13.05, 77.6)).toBe("remote"); // ~13km away
    expect(locationTag(null, null)).toBe("unknown");
    expect(locationTag(12.935, null)).toBe("unknown");

    vi.stubEnv("OFFICE_LAT", "not-a-number");
    expect(officeLocation()).toBeNull();
    expect(locationTag(12.935, 77.624)).toBe("unknown");

    vi.stubEnv("OFFICE_RADIUS_M", "99999999"); // over the 50km sanity cap → default 300m
    vi.stubEnv("OFFICE_LAT", "12.935");
    expect(officeLocation()?.radiusM).toBe(300);
  });

  it("computes sane distances", () => {
    expect(distanceM(12.935, 77.624, 12.935, 77.624)).toBe(0);
    const d = distanceM(12.935, 77.624, 12.945, 77.634); // ~1.56km diagonal
    expect(d).toBeGreaterThan(1400);
    expect(d).toBeLessThan(1700);
  });
});

describe("readJSON", () => {
  it("returns objects and rejects everything else without throwing", async () => {
    expect(await readJSON(post('{"a":1}'))).toEqual({ a: 1 });
    expect(await readJSON(post("{bad"))).toBeNull();
    expect(await readJSON(post("[1,2]"))).toBeNull();
    expect(await readJSON(post("null"))).toBeNull();
    expect(await readJSON(post('"str"'))).toBeNull();
    expect(await readJSON(post(""))).toBeNull();
  });

  it("takes the first forwarded IP", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    expect(clientIp(req)).toBe("203.0.113.7");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("rate limiter", () => {
  beforeEach(() => resetAll());

  it("allows up to max hits per window, then blocks until the window resets", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(hit("k", 3, 60_000, t).ok).toBe(true);
    const blocked = hit("k", 3, 60_000, t + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(59);
    expect(hit("k", 3, 60_000, t + 60_000).ok).toBe(true);
  });

  it("peek does not count, reset clears", () => {
    expect(peek("p", 2, 60_000).ok).toBe(true);
    hit("p", 2, 60_000);
    hit("p", 2, 60_000);
    expect(peek("p", 2, 60_000).ok).toBe(false);
    reset("p");
    expect(peek("p", 2, 60_000).ok).toBe(true);
  });

  it("keeps keys independent", () => {
    hit("a", 1, 60_000);
    expect(hit("a", 1, 60_000).ok).toBe(false);
    expect(hit("b", 1, 60_000).ok).toBe(true);
  });
});

describe("employee sessions & oauth state", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
  });

  const me = { email: "asha@innovinlabs.com", name: "Asha" };

  it("issues sessions that verify, expire after 30 days, and resist tampering", () => {
    const now = Date.now();
    const token = createUserSession(me, now)!;
    expect(verifyUserSession(token, now)).toEqual(me);
    expect(verifyUserSession(token, now + 30 * 24 * 3_600_000 - 1000)).toEqual(me);
    expect(verifyUserSession(token, now + 30 * 24 * 3_600_000 + 1000)).toBeNull();

    const dot = token.lastIndexOf(".");
    expect(verifyUserSession(`${token.slice(0, dot)}.${"0".repeat(64)}`, now)).toBeNull();
    expect(verifyUserSession("garbage")).toBeNull();
    vi.stubEnv("SESSION_SECRET", "other-secret");
    expect(verifyUserSession(token, now)).toBeNull();
  });

  it("returns null when no signing secret exists", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(createUserSession(me)).toBeNull();
    expect(verifyUserSession("x.y")).toBeNull();
  });

  it("oauth state round-trips the next path and rejects mismatched or stale cookies", () => {
    const now = Date.now();
    const { cookie, state } = createOauthState("/attendance", now);
    expect(verifyOauthState(cookie, state, now)).toBe("/attendance");
    expect(verifyOauthState(cookie, state, now + 11 * 60_000)).toBeNull();
    expect(verifyOauthState(cookie, "other-nonce.xyz", now)).toBeNull();
    expect(verifyOauthState(`${Date.now()}.n.sig`, state, now)).toBeNull();
    expect(verifyOauthState(undefined, state, now)).toBeNull();
    expect(verifyOauthState(cookie, null, now)).toBeNull();

    // next is sanitized: only same-origin paths survive.
    expect(sanitizeNext("/settings")).toBe("/settings");
    expect(sanitizeNext("https://evil.com")).toBe("/");
    expect(sanitizeNext("//evil.com")).toBe("/");
    expect(sanitizeNext(null)).toBe("/");
  });

  it("keeps OAuth redirects on the app origin after browser URL normalization", () => {
    for (const path of ["/\\evil.example", "/\t/evil.example", "/\n/evil.example"]) {
      expect(sanitizeNext(path)).toBe("/");
      const { cookie, state } = createOauthState(path);
      expect(verifyOauthState(cookie, state)).toBe("/");
    }
    expect(sanitizeNext("/planner?month=2026-10#today")).toBe("/planner?month=2026-10#today");
  });
});

describe("pgConfig", () => {
  it("disables TLS for local databases and strips sslmode", () => {
    const c = pgConfig("postgres://u:p@localhost:5432/db?sslmode=require", {});
    expect(c.ssl).toBe(false);
    expect(c.connectionString).toBe("postgres://u:p@localhost:5432/db");
  });

  it("verifies remote TLS by default and accepts an explicit trusted CA", () => {
    const url = "postgresql://u:p@db.abc.supabase.co:6543/postgres?sslmode=require&pgbouncer=true";
    const c = pgConfig(url, {});
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.connectionString).toContain("pgbouncer=true");
    expect(pgConfig(url, { DATABASE_SSL_VERIFY: "true" }).ssl).toEqual({ rejectUnauthorized: true });
    expect(pgConfig(url, { DATABASE_CA_CERT: "-----BEGIN\\nX\\n-----END" }).ssl).toEqual({
      ca: "-----BEGIN\nX\n-----END",
      rejectUnauthorized: true,
    });
  });

  it("rejects remote TLS downgrade while preserving pool size", () => {
    const c = pgConfig("postgres://u:p@db.internal:5432/db?sslmode=disable", { DATABASE_POOL_MAX: "2" });
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
    expect(c.max).toBe(2);
  });
});

describe("adminEmails", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads ADMIN_EMAILS, trimmed and lowercased", () => {
    vi.stubEnv("ADMIN_EMAILS", " A@innovinlabs.com, b@innovinlabs.com ,");
    expect(adminEmails()).toEqual(["a@innovinlabs.com", "b@innovinlabs.com"]);
  });
  it("falls back to OWNER_EMAILS when ADMIN_EMAILS is empty", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    vi.stubEnv("OWNER_EMAILS", "o@innovinlabs.com");
    expect(adminEmails()).toEqual(["o@innovinlabs.com"]);
  });
  it("is empty when neither is set", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    vi.stubEnv("OWNER_EMAILS", "");
    expect(adminEmails()).toEqual([]);
  });
});

describe("the cut", () => {
  it("no pantry, snack-order or Swiggy code is reachable", async () => {
    expect(Object.keys(await import("@/lib/submitter"))).not.toContain("pantryRef");
    expect(Object.keys(await import("@/lib/config"))).not.toContain("orderCutoffHour");
    const { existsSync } = await import("fs");
    for (const p of ["lib/pantry", "lib/menu.ts", "lib/order-state.ts", "app/api/snacks", "app/api/pantry-shop", "app/api/pantry-provider"]) expect(existsSync(p), p).toBe(false);
  });

  it("the cut: notifications never contain ping or pantry items", async () => {
    const src = (await import("fs")).readFileSync("lib/notifications.ts", "utf8");
    expect(src).not.toMatch(/"ping"|"pantry"|listPingsFor|listOrders/);
  });
});
