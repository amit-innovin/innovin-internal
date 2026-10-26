import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { fmtShortDate } from "@/lib/format";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { sendPush } from "@/lib/push";
import { id, store } from "@/lib/store";
import { pantryRef, setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import type { EventCategory } from "@/lib/types";

const CATEGORIES: EventCategory[] = ["sports", "arts", "culture", "learning", "social", "company"];

// datetime-local values are wall time in IST — the office's timezone.
const istToIso = (local: string) => {
  const ms = Date.parse(`${local}+05:30`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

const flash = (done: string) =>
  new NextResponse(null, { status: 303, headers: { Location: `/admin?tab=publish&done=${done}#events` } });

// Public: upcoming events with going counts + this device's RSVP state.
export async function GET(req: NextRequest) {
  const from = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // include today's in-progress events
  const rows = await store.listEvents(from, 30);
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const ref = user ? pantryRef(`rsvp:${user.email}`) : submitterIdentity(req).ref;
  const [counts, mine] = await Promise.all([store.rsvpCounts(rows.map((r) => r.id)), store.myRsvpEventIds(ref, user?.email)]);
  const myIds = new Set(mine);
  return NextResponse.json(
    rows.map(({ createdBy: _c, ...e }) => ({ ...e, going: counts[e.id] ?? 0, mine: myIds.has(e.id) })),
  );
}

// Admin-only. Plain form post: `_action=delete` removes, otherwise creates.
export async function POST(req: Request) {
  if (req.headers.get("content-type")?.includes("application/json")) {
    const { cookies } = await import("next/headers");
    const session = verifyUserSession((await cookies()).get(USER_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: "Sign in to publish an event" }, { status: 401 });
    const limited = enforce([["writeIp", clientIp(req)]]);
    if (limited) return limited;
    const body = await readJSON(req);
    if (!body) return badRequest();
    const title = str(body.title).trim();
    const startsAt = istToIso(str(body.startsAt));
    const category = str(body.category) as EventCategory;
    if (!title || title.length > 120 || !startsAt || !CATEGORIES.includes(category)) return badRequest("Enter a title, valid time and category");
    if (Date.parse(startsAt) < Date.now() - 60000) return badRequest("Choose a future event time");
    const event = await store.addEvent({ id: id(), title, startsAt, category, body: str(body.body).trim().slice(0, 500), location: str(body.location).trim().slice(0, 80), createdBy: session.email, createdAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, event: { id: event.id } }, { status: 201 });
  }
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

  const location = text("location", 80);
  await store.addEvent({
    id: id(),
    title,
    body: text("body", 500),
    category,
    startsAt,
    location,
    createdBy: "admin",
    createdAt: new Date().toISOString(),
  });
  // Best-effort: a push that fails must not fail the publish.
  await sendPush({
    title,
    body: `${fmtShortDate(startsAt)}${location ? ` · ${location}` : ""}`,
    href: "/events",
    tag: "event",
  }).catch(() => {});
  return flash("event-posted");
}

// RSVP toggle — verified employees follow their account; guests follow a browser capability.
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
  await store.setRsvp(eventId, session ? pantryRef(`rsvp:${session.email}`) : identity.ref, session?.email ?? null, going);
  const counts = await store.rsvpCounts([eventId]);
  const res = NextResponse.json({ going, count: counts[eventId] ?? 0 });
  setSubmitterCookie(res, identity.deviceId);
  return res;
}
