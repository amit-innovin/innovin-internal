import { store } from "@/lib/store";
import { cookies } from "next/headers";
import { pushSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { createOauthState, OAUTH_COOKIE, sanitizeNext, USER_COOKIE } from "@/lib/auth";
import { EMAIL_COOKIE, secureAuthCookie } from "@/lib/cookies";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

// Starts the Google sign-in flow. `next` is where the employee lands afterwards.
export async function GET(req: NextRequest) {
  const fallback = new URL("/settings", req.nextUrl.origin);
  if (!googleConfigured()) {
    fallback.searchParams.set("auth", "unavailable");
    return NextResponse.redirect(fallback);
  }
  const binding = pushSession(req.cookies.get(USER_COOKIE)?.value);
  if (binding) await store.revokePushSession(binding.sessionRef).catch(() => console.warn("[push] Session revocation failed; local identity still cleared"));
  const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
  const redirectUri = new URL("/api/auth/callback", req.nextUrl.origin).toString();
  const { cookie, state } = createOauthState(next);
  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  // A fresh chooser must not fall back to the previous local identity after cancellation
  // or a rejected account. Cookies are scoped to hostname, not localhost port.
  res.cookies.delete(USER_COOKIE);
  res.cookies.delete(EMAIL_COOKIE);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureAuthCookie(req.nextUrl.origin),
    maxAge: 600,
    path: "/",
  });
  return res;
}
