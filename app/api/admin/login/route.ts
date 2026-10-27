import { NextResponse } from "next/server";
import { secureAuthCookie } from "@/lib/cookies";
import { ADMIN_COOKIE, createAdminSession, validAdminPasscode } from "@/lib/admin";
import { ADMIN_SESSION_MS, LIMITS } from "@/lib/config";
import { clientIp, readJSON, tooMany } from "@/lib/http";
import { hit, peek, reset } from "@/lib/rate-limit";

const redirect = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

// Accepts a plain HTML form post (works without JavaScript) or JSON.
// Failed attempts are rate limited per IP and globally to stop PIN brute force.
export async function POST(req: Request) {
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  const ipKey = `adminLoginIp:${clientIp(req)}`;
  const globalKey = "adminLoginGlobal:all";
  const { adminLoginIp: ipLimit, adminLoginGlobal: globalLimit } = LIMITS;

  for (const [key, limit] of [
    [ipKey, ipLimit],
    [globalKey, globalLimit],
  ] as const) {
    const state = peek(key, limit.max, limit.windowMs);
    if (!state.ok) {
      return isJson ? tooMany(state.retryAfter, "Too many attempts — try again later") : redirect("/admin?error=locked");
    }
  }

  let passcode: unknown;
  if (isJson) passcode = (await readJSON(req))?.passcode;
  else passcode = (await req.formData().catch(() => null))?.get("passcode");

  if (!validAdminPasscode(passcode)) {
    hit(ipKey, ipLimit.max, ipLimit.windowMs);
    hit(globalKey, globalLimit.max, globalLimit.windowMs);
    return isJson ? NextResponse.json({ error: "Wrong passcode" }, { status: 401 }) : redirect("/admin?error=1");
  }

  reset(ipKey);
  const res = isJson ? NextResponse.json({ ok: true }) : redirect("/admin");
  res.cookies.set(ADMIN_COOKIE, createAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureAuthCookie(new URL(req.url).origin),
    maxAge: ADMIN_SESSION_MS / 1000,
    path: "/",
  });
  return res;
}
