import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminSession, validAdminPasscode, verifyAdminSession } from "@/lib/admin";
import { ADMIN_SESSION_MS, allowedEmailDomains, orderCutoffHour } from "@/lib/config";
import { clientIp, readJSON } from "@/lib/http";
import { pgConfig } from "@/lib/pgconfig";
import { hit, peek, reset, resetAll } from "@/lib/rate-limit";
import { istHour, todayIST } from "@/lib/time";

const post = (body: string) => new Request("http://x/api", { method: "POST", body, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
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
  it("parses ORDER_CUTOFF_HOUR, defaulting to open all day", () => {
    expect(orderCutoffHour()).toBe(24);
    vi.stubEnv("ORDER_CUTOFF_HOUR", "15");
    expect(orderCutoffHour()).toBe(15);
    for (const bad of ["abc", "-1", "25", "10.5"]) {
      vi.stubEnv("ORDER_CUTOFF_HOUR", bad);
      expect(orderCutoffHour()).toBe(24);
    }
  });

  it("normalises allowed email domains", () => {
    expect(allowedEmailDomains()).toEqual(["innovinlabs.com"]);
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", " InnovinLabs.com , partner.io ,");
    expect(allowedEmailDomains()).toEqual(["innovinlabs.com", "partner.io"]);
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

describe("admin auth", () => {
  beforeEach(() => vi.stubEnv("ADMIN_PASSCODE", "1704"));

  it("validates the passcode strictly", () => {
    expect(validAdminPasscode("1704")).toBe(true);
    for (const bad of ["1705", "17040", "", " 1704", 1704, null, undefined, ["1704"]]) expect(validAdminPasscode(bad)).toBe(false);
    vi.stubEnv("ADMIN_PASSCODE", "");
    expect(validAdminPasscode("")).toBe(false);
  });

  it("issues sessions that verify, expire, and resist tampering", () => {
    const now = Date.now();
    const token = createAdminSession(now);
    expect(verifyAdminSession(token, now)).toBe(true);
    expect(verifyAdminSession(token, now + ADMIN_SESSION_MS - 1000)).toBe(true);
    expect(verifyAdminSession(token, now + ADMIN_SESSION_MS + 1000)).toBe(false);

    const [issued, mac] = token.split(".");
    expect(verifyAdminSession(`${Number(issued) + 1}.${mac}`, now)).toBe(false);
    expect(verifyAdminSession(`${issued}.${mac.replace(/.$/, mac.endsWith("a") ? "b" : "a")}`, now)).toBe(false);
    expect(verifyAdminSession(`${now + 3_600_000}.${mac}`, now)).toBe(false);
    for (const bad of [undefined, "", "garbage", "123", ".abc", "NaN.abc"]) expect(verifyAdminSession(bad, now)).toBe(false);
  });

  it("invalidates every session when the passcode changes", () => {
    const token = createAdminSession();
    vi.stubEnv("ADMIN_PASSCODE", "a-new-long-passcode");
    expect(verifyAdminSession(token)).toBe(false);
  });

  it("rejects sessions when admin is disabled", () => {
    const token = createAdminSession();
    vi.stubEnv("ADMIN_PASSCODE", "");
    expect(verifyAdminSession(token)).toBe(false);
  });
});

describe("pgConfig", () => {
  it("disables TLS for local databases and strips sslmode", () => {
    const c = pgConfig("postgres://u:p@localhost:5432/db?sslmode=require", {});
    expect(c.ssl).toBe(false);
    expect(c.connectionString).toBe("postgres://u:p@localhost:5432/db");
  });

  it("uses encrypted TLS for remote hosts; verification is opt-in", () => {
    const url = "postgresql://u:p@db.abc.supabase.co:6543/postgres?sslmode=require&pgbouncer=true";
    const c = pgConfig(url, {});
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.connectionString).toContain("pgbouncer=true");
    expect(pgConfig(url, { DATABASE_SSL_VERIFY: "true" }).ssl).toEqual({ rejectUnauthorized: true });
    expect(pgConfig(url, { DATABASE_CA_CERT: "-----BEGIN\\nX\\n-----END" }).ssl).toEqual({
      ca: "-----BEGIN\nX\n-----END",
      rejectUnauthorized: true,
    });
  });

  it("honours sslmode=disable and pool size", () => {
    const c = pgConfig("postgres://u:p@db.internal:5432/db?sslmode=disable", { DATABASE_POOL_MAX: "2" });
    expect(c.ssl).toBe(false);
    expect(c.max).toBe(2);
  });
});
