import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { GRIEVANCE_IDS_COOKIE, longLivedCookie, NOTIFICATIONS_SEEN_COOKIE } from "@/lib/cookies";
import { feedFor, unreadCount } from "@/lib/notifications";
import { grievanceIdsFromCookie, grievancesFromIds } from "@/lib/submitter";

export const dynamic = "force-dynamic";

// The feed, plus how much of it is new. "Last seen" is a cookie rather than a stored column so
// it works for unsigned devices too, and so nothing about read state needs a schema.
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const grievances = await grievancesFromIds(grievanceIdsFromCookie(req.cookies.get(GRIEVANCE_IDS_COOKIE)?.value), 10);
  const items = await feedFor({ email: session?.email ?? null, grievances, now: Date.now() });
  const lastSeen = req.cookies.get(NOTIFICATIONS_SEEN_COOKIE)?.value ?? null;

  // Grievance bodies are the submitter's own words coming back to their own device; no
  // submitter refs are ever included.
  return NextResponse.json({ items, unread: unreadCount(items, lastSeen), lastSeen });
}

// Marks everything currently visible as read.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NOTIFICATIONS_SEEN_COOKIE, new Date().toISOString(), longLivedCookie);
  return res;
}
