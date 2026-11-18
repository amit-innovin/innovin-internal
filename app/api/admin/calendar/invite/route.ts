import { NextResponse } from "next/server";
import { currentActor } from "@/lib/admin";
import { sendInvite } from "@/lib/calendar";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";

// "Send again" for an invite that didn't go out. Same Google id as before, so never a second invite.
export async function POST(req: Request) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const event = await store.getEvent(str(body?.id).slice(0, 100));
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.cancelledAt || Date.parse(event.startsAt) <= Date.now()) return badRequest("Only upcoming events get invites");
  const invite = await sendInvite(event, actor.email);
  if (invite.state !== "sent") return NextResponse.json({ error: invite.state === "orphaned" ? "This invite's organizer has gone. It can't be changed from here." : "Google invite didn't go out. Reconnect Google Calendar and try again." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
