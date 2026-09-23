import { NextRequest, NextResponse } from "next/server";
import { createUserSession, OAUTH_COOKIE, USER_COOKIE, USER_SESSION_MS, verifyOauthState } from "@/lib/auth";
import { EMAIL_COOKIE, longLivedCookie } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { clientIp } from "@/lib/http";
import { exchangeCode, googleConfigured, verifyIdToken } from "@/lib/google";
import { store } from "@/lib/store";

const fail = (req: NextRequest, reason: string) => {
  const url = new URL("/settings", req.nextUrl.origin);
  url.searchParams.set("auth", reason);
  return NextResponse.redirect(url);
};

// Google redirect target: verifies CSRF state, exchanges the code, verifies the id_token,
// upserts the employee record and starts a signed session.
export async function GET(req: NextRequest) {
  if (enforce([["authIp", clientIp(req)]])) return fail(req, "busy");
  if (!googleConfigured()) return fail(req, "unavailable");

  const next = verifyOauthState(req.cookies.get(OAUTH_COOKIE)?.value, req.nextUrl.searchParams.get("state"));
  const code = req.nextUrl.searchParams.get("code");
  if (!next || !code) return fail(req, "failed");

  const redirectUri = new URL("/api/auth/callback", req.nextUrl.origin).toString();
  const idToken = await exchangeCode(code, redirectUri).catch(() => null);
  const identity = idToken ? await verifyIdToken(idToken).catch(() => null) : null;
  if (!identity) return fail(req, "failed");

  const now = new Date().toISOString();
  await store.upsertEmployee({ email: identity.email, name: identity.name, picture: identity.picture, createdAt: now, lastSeenAt: now });

  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin));
  const token = createUserSession({ email: identity.email, name: identity.name });
  if (token) res.cookies.set(USER_COOKIE, token, { ...longLivedCookie, maxAge: USER_SESSION_MS / 1000 });
  // Align the remembered-email cookie with the verified identity.
  res.cookies.set(EMAIL_COOKIE, identity.email, longLivedCookie);
  res.cookies.delete(OAUTH_COOKIE);
  return res;
}
