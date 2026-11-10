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

describe("role management (PATCH /api/people)", () => {
  const setRole = async () => (await import("@/lib/store")).store.setRole as ReturnType<typeof vi.fn>;
  const patch = async (json: unknown) => {
    const { PATCH } = await import("@/app/api/people/route");
    return PATCH(new NextRequest("https://internal.example/api/people", { method: "PATCH", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(json) }));
  };
  const directory: Record<string, "admin" | "member"> = { "a@innovinlabs.com": "admin", "m@innovinlabs.com": "member", "b@innovinlabs.com": "admin", "env@innovinlabs.com": "admin" };
  beforeEach(async () => {
    vi.stubEnv("ADMIN_EMAILS", "env@innovinlabs.com");
    getEmployee.mockImplementation(async (email: string) => (directory[email] ? row(email, directory[email]) : null));
    (await setRole()).mockClear();
    signIn(admin);
  });

  it("any admin can promote a member", async () => {
    const res = await patch({ email: "m@innovinlabs.com", role: "admin" });
    expect(res.status).toBe(200);
    expect(await setRole()).toHaveBeenCalledWith("m@innovinlabs.com", "admin");
  });

  it("any admin can demote another admin", async () => {
    expect((await patch({ email: "b@innovinlabs.com", role: "member" })).status).toBe(200);
    expect(await setRole()).toHaveBeenCalledWith("b@innovinlabs.com", "member");
  });

  it("refuses to demote an ADMIN_EMAILS admin", async () => {
    const res = await patch({ email: "env@innovinlabs.com", role: "member" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Set in ADMIN_EMAILS — change it there");
    expect(await setRole()).not.toHaveBeenCalled();
  });

  it("refuses to change your own role", async () => {
    const res = await patch({ email: "a@innovinlabs.com", role: "member" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("You can't change your own role");
  });

  it("rejects the retired owner role", async () => {
    expect((await patch({ email: "m@innovinlabs.com", role: "owner" })).status).toBe(400);
  });

  it("a member can't change roles", async () => {
    signIn(member);
    expect((await patch({ email: "m@innovinlabs.com", role: "admin" })).status).toBe(401);
    expect(await setRole()).not.toHaveBeenCalled();
  });
});

describe("admin-only APIs answer members with JSON errors", () => {
  beforeEach(() => {
    signIn(member);
    getEmployee.mockResolvedValue(row(member.email, "member"));
  });
  const cookie = () => `innovin_user=${jar.get("innovin_user")}`;
  const req = (path: string, method = "GET", body?: unknown) =>
    new NextRequest(`https://internal.example${path}`, { method, headers: { cookie: cookie(), "Content-Type": "application/json", origin: "https://internal.example" }, body: body ? JSON.stringify(body) : undefined });

  it.each([
    ["GET /api/grievances", async () => (await import("@/app/api/grievances/route")).GET(req("/api/grievances"))],
    ["PATCH /api/grievances", async () => (await import("@/app/api/grievances/route")).PATCH(req("/api/grievances", "PATCH", { id: "x", status: "resolved" }))],
    ["GET /api/away", async () => (await import("@/app/api/away/route")).GET(req("/api/away"))],
    ["PATCH /api/leave", async () => (await import("@/app/api/leave/route")).PATCH(req("/api/leave", "PATCH", {}))],
    ["POST /api/announcements", async () => (await import("@/app/api/announcements/route")).POST(req("/api/announcements", "POST", { title: "t", body: "b" }))],
  ])("%s", async (_name, call) => {
    const res = (await call()) as Response;
    expect([401, 403]).toContain(res.status);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
