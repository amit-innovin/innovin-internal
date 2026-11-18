import { NextResponse } from "next/server";
import { currentActor } from "@/lib/admin";
import { calendarConfigured, handOverPlan, retireCalendar } from "@/lib/calendar";
import { enforce } from "@/lib/guard";
import { clientIp } from "@/lib/http";
import { store } from "@/lib/store";

// The signed-in admin's Google Calendar connection. Never returns anything about the token itself.
export async function GET() {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!calendarConfigured()) return NextResponse.json({ configured: false, connected: null, me: actor.email });
  const row = await store.getCalendarToken(actor.email);
  return NextResponse.json({
    configured: true,
    me: actor.email,
    connected: row ? { email: row.email, since: row.createdAt } : null,
    ...(row ? await handOverPlan(actor.email) : { upcoming: 0, successor: null, successorName: null }),
  });
}

// Disconnect: hand over (or orphan) upcoming invites, revoke at Google, delete the stored token.
export async function POST(req: Request) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  return NextResponse.json(await retireCalendar(actor.email));
}
