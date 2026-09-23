import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import type { EventCategory } from "@/lib/types";

const CATEGORIES: EventCategory[] = ["sports", "arts", "culture", "learning", "social", "company"];

// datetime-local values are wall time in IST — the office's timezone.
const istToIso = (local: string) => {
  const ms = Date.parse(`${local}+05:30`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

const flash = (done: string) =>
  new NextResponse(null, { status: 303, headers: { Location: `/admin?done=${done}#events` } });

// Public: upcoming events with going counts + this device's RSVP state.
export async function GET(req: NextRequest) {
  const from = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // include today's in-progress events
  const rows = await store.listEvents(from, 30);
  const ref = submitterIdentity(req).ref;
  const [counts, mine] = await Promise.all([store.rsvpCounts(rows.map((r) => r.id)), store.myRsvpEventIds(ref)]);
  const myIds = new Set(mine);
  return NextResponse.json(
    rows.map(({ createdBy: _c, ...e }) => ({ ...e, going: counts[e.id] ?? 0, mine: myIds.has(e.id) })),
  );
}

// Admin-only. Plain form post: `_action=delete` removes, otherwise creates.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

  if (form.get("_action") === "delete") {
    await store.deleteEvent(text("id", 100));
    return flash("event-deleted");
  }

  const title = text("title", 120);
  const category = text("category", 20) as EventCategory;
  const startsAt = istToIso(text("startsAt", 20));
  if (!title) return flash("missing-title");
  if (!startsAt || !CATEGORIES.includes(category)) return flash("invalid-event");

  await store.addEvent({
    id: id(),
    title,
    body: text("body", 500),
    category,
    startsAt,
    location: text("location", 80),
    createdBy: "admin",
    createdAt: new Date().toISOString(),
  });
  return flash("event-posted");
}

// RSVP toggle — one row per device per event; signed-in employees attach their verified email.
export async function PATCH(req: NextRequest) {
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["rsvpDevice", identity.ref],
    ["writeIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  const eventId = str(body.eventId).trim();
  const going = body.going === true;
  if (!eventId) return badRequest();
  if (!(await store.getEvent(eventId))) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  await store.setRsvp(eventId, identity.ref, going ? (session?.email ?? null) : null, going);
  const counts = await store.rsvpCounts([eventId]);
  const res = NextResponse.json({ going, count: counts[eventId] ?? 0 });
  setSubmitterCookie(res, identity.deviceId);
  return res;
}
