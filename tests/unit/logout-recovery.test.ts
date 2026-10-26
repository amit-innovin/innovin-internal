import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ token: "", revoke: vi.fn(async () => { throw new Error("Database unavailable"); }) }));
vi.mock("@/lib/store", () => ({ store: { revokePushSession: state.revoke } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
import { createUserSession, USER_COOKIE } from "@/lib/auth";
import { POST as logout } from "@/app/api/auth/logout/route";
import { DELETE as forget } from "@/app/api/attendance/route";
import { GET as switchAccount } from "@/app/api/auth/google/route";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("clears local identity even when push revocation fails", async () => {
  vi.stubEnv("SESSION_SECRET", "test-secret"); vi.stubEnv("GOOGLE_CLIENT_ID", "test-client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  state.token = createUserSession({ email: "a@innovinlabs.com", name: "A" })!;
  for (const response of [await logout(), await forget(), await switchAccount(new NextRequest("https://internal.example/api/auth/google", { headers: { cookie: `${USER_COOKIE}=${state.token}` } }))]) {
    expect(response.status).toBeLessThan(400);
    expect(response.cookies.get(USER_COOKIE)?.value).toBe("");
  }
  expect(state.revoke).toHaveBeenCalledTimes(3);
});
