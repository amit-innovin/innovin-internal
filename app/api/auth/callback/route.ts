import { NextRequest, NextResponse } from "next/server";
import { createUserSession, OAUTH_COOKIE, USER_COOKIE, USER_SESSION_MS, verifyOauthState } from "@/lib/auth";
import { adminEmails } from "@/lib/config";
import { EMAIL_COOKIE, longLivedCookie, secureAuthCookie } from "@/lib/cookies";
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
  if (!next || !code) {
    console.warn("[google-auth] Callback rejected:", !code ? "missing authorization code" : "missing or expired state cookie");
    return fail(req, "failed");
  }

  const redirectUri = new URL("/api/auth/callback", req.nextUrl.origin).toString();
  const idToken = await exchangeCode(code, redirectUri).catch(() => {
    console.warn("[google-auth] Google token exchange could not be reached");
    return null;
  });
  if (!idToken) console.warn("[google-auth] Google token exchange failed");
  const identity = idToken ? await verifyIdToken(idToken).catch(() => null) : null;
  if (!identity) {
    if (idToken) console.warn("[google-auth] Google identity verification failed");
    return fail(req, "failed");
  }

  const now = new Date().toISOString();
  // `role` applies to the insert only — upsert never overwrites a granted role. Bootstrap
  // admins (ADMIN_EMAILS) are re-promoted on every sign-in, so they can't be locked out.
  const bootstrapAdmin = adminEmails().includes(identity.email.toLowerCase());
  await store.upsertEmployee({
    email: identity.email,
    name: identity.name,
    picture: identity.picture,
    role: bootstrapAdmin ? "admin" : "member",
    joinedOn: null,
    stepsOffset: 0,
    createdAt: now,
    lastSeenAt: now,
  });
  if (bootstrapAdmin) await store.setRole(identity.email, "admin");

  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin));
  const token = createUserSession({ email: identity.email, name: identity.name });
  if (token) res.cookies.set(USER_COOKIE, token, { ...longLivedCookie, secure: secureAuthCookie(req.nextUrl.origin), maxAge: USER_SESSION_MS / 1000 });
  // Align the remembered-email cookie with the verified identity.
  res.cookies.set(EMAIL_COOKIE, identity.email, { ...longLivedCookie, secure: secureAuthCookie(req.nextUrl.origin) });
  res.cookies.delete(OAUTH_COOKIE);
  return res;
}
