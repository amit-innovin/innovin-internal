import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/lib/admin";
import { verifyOauthState } from "@/lib/auth";
import { CAL_PKCE_COOKIE, CAL_STATE_COOKIE, CALENDAR_SCOPE, calendarConfigured, exchangeCalendarCode, revokeGrant, saveConnection } from "@/lib/calendar";
import { store } from "@/lib/store";
import { enforce } from "@/lib/guard";
import { verifyIdToken } from "@/lib/google";
import { clientIp } from "@/lib/http";

// Google sends the admin back here. Refused unless: the state and PKCE cookies match, the person is
// still a signed-in admin, the Google account is that same admin, and calendar access was granted.
export async function GET(req: NextRequest) {
  const done = (result: string) => {
    const res = NextResponse.redirect(new URL(`/admin/publish?tab=events&calendar=${result}`, req.nextUrl.origin));
    res.cookies.delete({ name: CAL_STATE_COOKIE, path: "/api/admin/calendar" });
    res.cookies.delete({ name: CAL_PKCE_COOKIE, path: "/api/admin/calendar" });
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  if (enforce([["authIp", clientIp(req)]])) return done("failed");
  if (!calendarConfigured()) return done("unavailable");
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  if ((await store.getEmployee(actor.email))?.leftOn) return done("left");
  const ok = verifyOauthState(req.cookies.get(CAL_STATE_COOKIE)?.value, req.nextUrl.searchParams.get("state"));
  const code = req.nextUrl.searchParams.get("code");
  const verifier = req.nextUrl.searchParams.get("error") ? null : req.cookies.get(CAL_PKCE_COOKIE)?.value;
  if (!ok || !code || !verifier) return done("failed");

  const redirectUri = new URL("/api/admin/calendar/callback", req.nextUrl.origin).toString();
  const grant = await exchangeCalendarCode(code, redirectUri, verifier);
  if (!grant) return done("failed");
  const identity = await verifyIdToken(grant.idToken).catch(() => null);
  // A grant we won't keep is handed straight back to Google, never left live.
  if (!identity || identity.email !== actor.email.toLowerCase()) { await revokeGrant(grant.refreshToken); return done("wrong-account"); }
  if (!grant.scope.split(/\s+/).includes(CALENDAR_SCOPE)) { await revokeGrant(grant.refreshToken); return done("no-scope"); }
  return done((await saveConnection(actor.email, grant.refreshToken, grant.scope)) ? "connected" : "unavailable");
}
