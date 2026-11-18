import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/lib/admin";
import { createOauthState } from "@/lib/auth";
import { CAL_PKCE_COOKIE, CAL_STATE_COOKIE, calendarAuthUrl, calendarConfigured, pkcePair } from "@/lib/calendar";
import { secureAuthCookie } from "@/lib/cookies";

const back = (req: NextRequest, result: string) => NextResponse.redirect(new URL(`/admin/publish?tab=events&calendar=${result}`, req.nextUrl.origin));

// Starts "Connect Google Calendar" for the signed-in admin: signed state + PKCE, both in short-lived
// httpOnly cookies scoped to these routes, and Google is told which account to expect.
export async function GET(req: NextRequest) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  if (!calendarConfigured()) return back(req, "unavailable");
  const { cookie, state } = createOauthState("/admin/publish?tab=events");
  const { verifier, challenge } = pkcePair();
  const redirectUri = new URL("/api/admin/calendar/callback", req.nextUrl.origin).toString();
  const res = NextResponse.redirect(calendarAuthUrl(redirectUri, state, challenge, actor.email));
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: secureAuthCookie(req.nextUrl.origin), maxAge: 600, path: "/api/admin/calendar" };
  res.cookies.set(CAL_STATE_COOKIE, cookie, opts);
  res.cookies.set(CAL_PKCE_COOKIE, verifier, opts);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
