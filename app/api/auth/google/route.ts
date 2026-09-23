import { NextRequest, NextResponse } from "next/server";
import { createOauthState, OAUTH_COOKIE, sanitizeNext } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

// Starts the Google sign-in flow. `next` is where the employee lands afterwards.
export async function GET(req: NextRequest) {
  const fallback = new URL("/settings", req.nextUrl.origin);
  if (!googleConfigured()) {
    fallback.searchParams.set("auth", "unavailable");
    return NextResponse.redirect(fallback);
  }
  const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
  const redirectUri = new URL("/api/auth/callback", req.nextUrl.origin).toString();
  const { cookie, state } = createOauthState(next);
  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
