import { NextResponse } from "next/server";
import { currentActor } from "@/lib/admin";
import { retryInvite } from "@/lib/calendar";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";

// "Send again": finishes an invite, edit or cancel that didn't reach Google. Never sends a second
// invite: the same Google id and calendar as before, and nothing at all for one that already went out.
export async function POST(req: Request) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const event = await store.getEvent(str(body?.id).slice(0, 100));
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (Date.parse(event.startsAt) <= Date.now()) return badRequest("Only upcoming events get invites");
  const result = await retryInvite(event, actor.email);
  if (result === "done") return NextResponse.json({ ok: true });
  const error = { "not-needed": "This invite is already up to date.", orphaned: "This invite's organizer has gone. It can't be changed from here.", failed: "Google didn't take it. Reconnect Google Calendar and try again." }[result];
  return NextResponse.json({ error }, { status: 409 });
}
