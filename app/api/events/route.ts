import { eventHref } from "@/lib/journey";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { fmtShortDate } from "@/lib/format";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { sendPush } from "@/lib/push";
import { calendarConfigured, mayExist, removeInvite, sendInvite, updateInvite } from "@/lib/calendar";
import { id, store } from "@/lib/store";
import { accountRef, setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import type { EventCategory, EventRow } from "@/lib/types";

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
  const focused=req.nextUrl.searchParams.get("event");
  if(focused&&focused.length>180)return badRequest("Invalid event");
  const target=focused?await store.getEvent(focused):null;
  // Every upcoming event (an office has a handful): a later one must not drop off Publish.
  const rows = focused ? (target?[target]:[]) : await store.listEvents(from, 200);
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const ref = user ? accountRef(`rsvp:${user.email}`) : submitterIdentity(req).ref;
  const [counts, mine] = await Promise.all([store.rsvpCounts(rows.map((r) => r.id)), store.myRsvpEventIds(ref, user?.email)]);
  const myIds = new Set(mine);
  const admin=await isAdmin();
  // Admins also see whether each event's Google invite went out.
  const inviteRows = new Map((await store.listEventInvites()).map((i) => [i.eventId, i]));
  // Headcounts are for admins only (as in the Feed). Everyone learns whether the event went out as a
  // Google Calendar invite; admins also see its state ("stale": an edit or cancel didn't reach Google).
  return NextResponse.json(
    rows.map(({ createdBy, ...e }) => {
      const invite = inviteRows.get(e.id);
      return {
        ...e, canManage: !e.cancelledAt && Date.parse(e.startsAt)>Date.now() && (admin || !!user && createdBy===user.email), mine: myIds.has(e.id),
        inCalendar: invite?.state === "sent",
        ...(admin ? { going: counts[e.id] ?? 0, invite: invite ? (invite.state === "failed" && mayExist(invite) ? "stale" : invite.state) : null } : {}),
      };
    }),
  );
}

// Admin-only. Plain form post: `_action=delete` removes, otherwise creates.
export async function POST(req: Request) {
  if (req.headers.get("content-type")?.includes("application/json")) {
    const { cookies } = await import("next/headers");
    const session = verifyUserSession((await cookies()).get(USER_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: "Sign in to publish an event" }, { status: 401 });
    // Events are published by admins (prototype composer: "Events and announcements are posted by admins").
    if (!(await isAdmin())) return NextResponse.json({ error: "Only admins publish events" }, { status: 401 });
    const limited = enforce([["writeIp", clientIp(req)]]);
    if (limited) return limited;
    const body = await readJSON(req);
    if (!body) return badRequest();
    // { action: "delete", id }: removed without a notification (Cancel tells people).
    if (body.action === "delete") {
      const eid = str(body.id).slice(0, 100);
      if (!eid) return badRequest("Which event?");
      // An invite still in people's calendars must come out first, or nobody could ever remove it.
      if (!(await removeInvite(eid, false).catch(() => false))) return NextResponse.json({ error: "Couldn't remove the Google invite. Try again, or cancel the event instead." }, { status: 502 });
      await store.deleteEvent(eid);
      return NextResponse.json({ ok: true });
    }
    const title = str(body.title).trim();
    const startsAt = istToIso(str(body.startsAt));
    const category = str(body.category) as EventCategory;
    if (!title || title.length > 120 || !startsAt || !CATEGORIES.includes(category)) return badRequest("Enter a title, valid time and category");
    if (Date.parse(startsAt) < Date.now() - 60000) return badRequest("Choose a future event time");
    const event = await store.addEvent({ id: id(), title, startsAt, category, body: str(body.body).trim().slice(0, 500), location: str(body.location).trim().slice(0, 80), createdBy: session.email, createdAt: new Date().toISOString() });
    await sendPush({title:"New team event",body:"Open the app for details.",href:eventHref(event.id),tag:`event-${event.id}`}).catch(()=>{});
    // Google Calendar invites from this admin's calendar. Best-effort: the event is published either way.
    const invite = body.invite === true && calendarConfigured() ? (await sendInvite(event, session.email).catch(() => null))?.state ?? "failed" : null;
    return NextResponse.json({ ok: true, event: { id: event.id }, invite }, { status: 201 });
  }
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

  if (form.get("_action") === "delete") {
    if (!(await removeInvite(text("id", 100), false).catch(() => false))) return flash("invalid-event");
    await store.deleteEvent(text("id", 100));
    return flash("event-deleted");
  }

  const title = text("title", 120);
  const category = text("category", 20) as EventCategory;
  const startsAt = istToIso(text("startsAt", 20));
  if (!title) return flash("missing-title");
  if (!startsAt || !CATEGORIES.includes(category) || Date.parse(startsAt)<Date.now()-60000) return flash("invalid-event");

  const location = text("location", 80);
  const published = await store.addEvent({
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
    href: eventHref(published.id),
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
  if(body.action==="update")return manageEvent(req,body,false);
  const eventId = str(body.eventId).trim();
  const going = body.going === true;
  if (!eventId) return badRequest();
  const event = await store.getEvent(eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if(event.cancelledAt)return NextResponse.json({error:"This event has been cancelled"},{status:409});

  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const savedRsvp=await store.setRsvp(eventId, session ? accountRef(`rsvp:${session.email}`) : identity.ref, session?.email ?? null, going);
  if(!savedRsvp)return NextResponse.json({error:"The event was cancelled or removed. Refresh the event list."},{status:409});
  // The headcount goes to admins only.
  const res = NextResponse.json((await isAdmin()) ? { going, count: (await store.rsvpCounts([eventId]))[eventId] ?? 0 } : { going });
  setSubmitterCookie(res, identity.deviceId);
  return res;
}

// Creator edits and cancellation preserve the shared event and its existing RSVPs.
async function manageEvent(req: NextRequest, body: Record<string,unknown>, cancel: boolean) {
  const user=verifyUserSession(req.cookies.get(USER_COOKIE)?.value), admin=await isAdmin();
  if(!user && !admin)return NextResponse.json({error:"Sign in to manage an event"},{status:401});
  const row=await store.getEvent(str(body.id));
  if(!row)return NextResponse.json({error:"Event not found"},{status:404});
  if(!admin && row.createdBy!==user?.email)return NextResponse.json({error:"Only the organizer or an admin can change this event"},{status:403});
  if(row.cancelledAt || Date.parse(row.startsAt)<=Date.now())return NextResponse.json({error:"Cancelled or past events cannot be changed"},{status:409});
  const expected=str(body.expectedUpdatedAt);
  if(!expected || !Number.isFinite(Date.parse(expected)))return badRequest("Reload this event before changing it");
  const title=cancel?row.title:str(body.title).trim(), category=cancel?row.category:str(body.category) as EventCategory;
  const startsAt=cancel?row.startsAt:istToIso(str(body.startsAt));
  if(!title || title.length>120 || !startsAt || !CATEGORIES.includes(category) || (!cancel && Date.parse(startsAt)<=Date.now()))return badRequest("Enter a title, future IST time and category");
  const updatedAt=new Date(Math.max(Date.now(),Date.parse(expected)+1)).toISOString();
  const patch={title,category,startsAt,body:cancel?row.body:str(body.body).trim().slice(0,500),location:cancel?row.location:str(body.location).trim().slice(0,80),...(cancel?{cancelledAt:updatedAt}:{})};
  const changed=await store.updateEvent(row.id,expected,patch,updatedAt);
  if(!changed)return NextResponse.json({error:"This event changed in another tab. Reload before editing."},{status:409});
  // The Google invite follows; say so when it couldn't (Send again on Publish finishes it).
  const invited = await store.getEventInvite(row.id);
  const followed = !invited ? null : cancel ? await removeInvite(row.id, true).catch(() => false) : (await updateInvite(changed).catch(() => null))?.state === "sent";
  const attendees=await store.listRsvps(row.id);
  await Promise.all([...new Set(attendees.flatMap(r=>r.email?[r.email]:[]))].map(email=>sendPush({title:cancel?"An event was cancelled":"An event was updated",body:"Open the app for the latest details.",href:eventHref(row.id),tag:`event-${row.id}`},email).catch(()=>{})));
  return NextResponse.json({ok:true,event:changed,invite:followed===null?null:followed?"sent":"stale"});
}
export async function DELETE(req: NextRequest) {
  const limited=enforce([["writeIp",clientIp(req)]]);if(limited)return limited;
  const body=await readJSON(req);if(!body)return badRequest();
  return manageEvent(req,body,true);
}
