import { fulfillmentOf,FULFILLMENT_LABELS } from "./order-state";
import { todayIST } from "./time";
import { boardHref,attendanceHref,eventHref } from "./journey";
import { fmtShortDate } from "./format";
import { LEAVE_LABELS } from "./leave";
import { store } from "./store";
import type { GrievanceRow } from "./types";

// The notification feed is derived, not stored: there is no notifications table, just a read of
// what already happened plus a per-viewer "last seen" marker for the unread count. That keeps
// it honest — nothing can claim an event that didn't happen to a row somewhere.
//
// Grievance items are the exception in how they're scoped: the app holds no link from a
// grievance to a person, so they're resolved from the ids the browser itself supplies. That's
// also why they can never be pushed (see PushSubscriptionRow).

export type Notification = {
  id: string;
  kind: "announcement" | "event" | "away" | "grievance" | "ping" | "pantry";
  title: string;
  body: string;
  at: string;
  href: string;
};

const LOOKBACK_DAYS = 30;

// Grievances arrive already stripped of their submitter ref — the type says so.
export async function feedFor(opts: { email: string | null; grievances: Omit<GrievanceRow, "submitterRef">[]; now: number }) {
  const since = new Date(opts.now - LOOKBACK_DAYS * 86_400_000).toISOString();

  const [announcements, events, away, pings, employees] = await Promise.all([
    store.listAnnouncements(10),
    store.listEvents(new Date(opts.now).toISOString(), 10),
    opts.email ? store.listAwayByEmail(opts.email, 20) : Promise.resolve([]),
    opts.email ? store.listPingsFor(opts.email, 50) : Promise.resolve([]),
    opts.email ? store.listEmployees() : Promise.resolve([]),
  ]);

  const items: Notification[] = [];

  for (const a of announcements) {
    if (a.createdAt < since) continue;
    items.push({ id: `ann-${a.id}`, kind: "announcement", title: a.title, body: a.body, at: a.createdAt, href: boardHref(a.id) });
  }

  // Upcoming events are news until they happen, so they're keyed on publication time.
  for (const e of events) {
    if ((e.updatedAt??e.createdAt) < since) continue;
    items.push({
      id: `evt-${e.id}-${e.updatedAt??e.createdAt}`,
      kind: "event",
      title: `${e.cancelledAt?"Cancelled: ":e.updatedAt?"Updated: ":""}${e.title}`,
      body: `${fmtShortDate(e.startsAt)}${e.location ? ` · ${e.location}` : ""}`,
      at: e.updatedAt??e.createdAt,
      href: eventHref(e.id),
    });
  }

  if(opts.email) {
    const trays=(await store.listOrders(todayIST())).filter(r=>r.orderedBy===opts.email&&r.fulfillmentAt);
    const first=trays[0];if(first?.fulfillmentAt)items.push({id:`pantry-${first.date}-${fulfillmentOf(first)}`,kind:"pantry",title:FULFILLMENT_LABELS[fulfillmentOf(first)],body:"Your pantry request",at:first.fulfillmentAt,href:trays.some(r=>r.product)?"/pantry":"/snacks?tab=today"});
    const me=employees.find(e=>e.email===opts.email);
    if(me?.role==="admin")for(const r of await store.listPendingAway())items.push({id:`pending-away-${r.id}`,kind:"away",title:"Time-away request awaiting review",body:"Open Approvals to review it.",at:r.createdAt,href:"/admin?tab=approvals#away"});
  }

  // A decision on your own request — only ever for a verified identity.
  for (const r of away) {
    if (r.status === "pending" || !r.decidedAt || r.decidedAt < since) continue;
    const what = r.type === "wfh" ? "Work from home" : `${r.leaveType ? LEAVE_LABELS[r.leaveType] : ""} leave`.trim();
    items.push({
      id: `away-${r.id}-${r.status}`,
      kind: "away",
      title: `${what} ${r.status}`,
      body: `${fmtShortDate(`${r.startDate}T00:00:00`)}${r.decidedBy ? ` · by ${r.decidedBy}` : ""}`,
      at: r.decidedAt,
      href: attendanceHref("leave",undefined,r.id),
    });
  }

  // Unread pings land here too — tapping one opens that thread on People.
  const names = new Map(employees.map((e) => [e.email, e.name]));
  for (const p of pings) {
    if (p.toEmail !== opts.email || p.readAt) continue;
    items.push({
      id: `ping-${p.id}`,
      kind: "ping",
      title: `${names.get(p.fromEmail) ?? p.fromEmail} pinged you`,
      body: p.body,
      at: p.createdAt,
      href: `/people?ping=${encodeURIComponent(p.fromEmail)}`,
    });
  }

  // Device-scoped: these rows came from ids the browser presented, never from a stored link.
  for (const g of opts.grievances) {
    if (g.status === "open") continue;
    items.push({
      id: `grv-${g.id}-${g.status}`,
      kind: "grievance",
      title: `Your feedback is ${g.status === "in_progress" ? "in progress" : "resolved"}`,
      body: g.body.slice(0, 80),
      at: g.updatedAt ?? g.createdAt,
      href: "/grievances",
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

export const unreadCount = (items: Notification[], lastSeen: string | null) =>
  lastSeen ? items.filter((i) => i.at > lastSeen).length : items.length;
