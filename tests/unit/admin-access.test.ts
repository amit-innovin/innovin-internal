import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createUserSession } from "@/lib/auth";

// Admin access comes only from a verified Google identity whose directory role is admin.
// Pages use requireUser/requireAdmin (redirects); APIs use isAdmin/currentActor (JSON errors).

const jar = new Map<string, string>();
const hdrs = new Headers();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
  headers: async () => hdrs,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const getEmployee = vi.fn();
vi.mock("@/lib/store", () => ({
  store: {
    getEmployee: (email: string) => getEmployee(email),
    upsertEmployee: vi.fn(async (row: unknown) => row),
    setRole: vi.fn(async () => true),
    revokePushSession: vi.fn(async () => undefined),
  },
  id: () => "unused",
}));

const member = { email: "m@innovinlabs.com", name: "Meera" };
const admin = { email: "a@innovinlabs.com", name: "Arjun" };
const row = (email: string, role: "admin" | "member") => ({ email, name: email, picture: "", role, joinedOn: null, stepsOffset: 0, createdAt: "", lastSeenAt: "" });
const signIn = (who: { email: string; name: string }) => jar.set("innovin_user", createUserSession(who)!);

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret");
  jar.clear();
  for (const k of [...hdrs.keys()]) hdrs.delete(k);
  getEmployee.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("page guards", () => {
  it("requireAdmin sends a signed-in member home", async () => {
    const { requireAdmin } = await import("@/lib/admin");
    signIn(member);
    getEmployee.mockResolvedValue(row(member.email, "member"));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/");
  });

  it("requireAdmin returns the actor for an admin", async () => {
    const { requireAdmin } = await import("@/lib/admin");
    signIn(admin);
    getEmployee.mockResolvedValue(row(admin.email, "admin"));
    await expect(requireAdmin()).resolves.toEqual({ ...admin, role: "admin" });
  });

  it("requireAdmin sends a signed-out visitor to sign-in, remembering the page", async () => {
    const { requireAdmin } = await import("@/lib/admin");
    hdrs.set("x-pathname", "/admin");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/sign-in?next=%2Fadmin");
  });

  it("requireUser rejects a forged session cookie", async () => {
    const { requireUser } = await import("@/lib/admin");
    jar.set("innovin_user", "forged.sig");
    hdrs.set("x-pathname", "/attendance");
    await expect(requireUser()).rejects.toThrow("REDIRECT:/sign-in?next=%2Fattendance");
  });

  it("never carries an unsafe next path into the sign-in redirect", async () => {
    const { requireUser } = await import("@/lib/admin");
    hdrs.set("x-pathname", "//evil.com");
    await expect(requireUser()).rejects.toThrow("REDIRECT:/sign-in?next=%2F");
  });
});

describe("isAdmin", () => {
  it("reads the role from the directory on every request, so a demotion applies immediately", async () => {
    const { isAdmin } = await import("@/lib/admin");
    signIn(admin);
    getEmployee.mockResolvedValueOnce(row(admin.email, "admin")).mockResolvedValueOnce(row(admin.email, "member"));
    expect(await isAdmin()).toBe(true);
    expect(await isAdmin()).toBe(false);
  });

  it("grants nothing to the retired passcode cookie", async () => {
    const { isAdmin } = await import("@/lib/admin");
    const { createHmac } = await import("crypto");
    // A correctly signed token from the retired break-glass passcode scheme.
    vi.stubEnv("ADMIN_PASSCODE", "1704");
    const issued = Date.now();
    jar.set("innovin_admin", `${issued}.${createHmac("sha256", "1704").update(`innovin-admin-session-v2:${issued}`).digest("hex")}`);
    expect(await isAdmin()).toBe(false);
  });
});

describe("sign-in without a session secret", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ADMIN_PASSCODE", "1704");
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  });

  it("no longer signs sessions with the admin passcode", () => {
    expect(createUserSession(member)).toBeNull();
  });

  it("starting sign-in fails visibly instead of crashing", async () => {
    const { GET } = await import("@/app/api/auth/google/route");
    const res = await GET(new NextRequest("https://internal.example/api/auth/google?next=/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://internal.example/sign-in?auth=unavailable");
  });

  it("the callback fails visibly instead of looping", async () => {
    const { GET } = await import("@/app/api/auth/callback/route");
    const res = await GET(new NextRequest("https://internal.example/api/auth/callback?code=c&state=s"));
    expect(res.headers.get("location")).toBe("https://internal.example/sign-in?auth=unavailable");
  });
});

describe("allowed email domains", () => {
  afterEach(() => vi.unstubAllGlobals());
  const tokeninfo = (email: string) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ aud: "id", email, email_verified: "true", name: "X", exp: Math.floor(Date.now() / 1000) + 600 }))));

  it("accepts every domain in ALLOWED_EMAIL_DOMAINS and nothing else", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "innovinlabs.com,innovin.dev");
    const { verifyIdToken } = await import("@/lib/google");
    tokeninfo("x@innovin.dev");
    expect((await verifyIdToken("t"))?.email).toBe("x@innovin.dev");
    tokeninfo("x@gmail.com");
    expect(await verifyIdToken("t")).toBeNull();
  });
});
