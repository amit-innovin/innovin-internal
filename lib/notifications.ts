import { boardHref,eventHref,leaveHref } from "./journey";
import { fmtShortDate } from "./format";
import { LEAVE_LABELS } from "./leave";
import { inOfficeToday, snackTimes } from "./snack-times";
import { hiReplyTitle, hiTitle, INVITES } from "./hi";
import { currentRound } from "./snacks-rules";
import { store } from "./store";
import { todayIST } from "./time";

// "11:00", "3:30", "4 PM", as the app says times elsewhere.
const clock = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); const h12 = h % 12 || 12; return m === 0 && h >= 12 ? `${h12} PM` : `${h12}:${String(m).padStart(2, "0")}`; };
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
  kind: "announcement" | "event" | "away" | "grievance" | "kudos" | "tea" | "hi";
  // Say hi invites you received: answer inline. yes/no once answered.
  hi?: { id: string; invite: boolean; reply: "yes" | "no" | null; from: string };
  title: string;
  body: string;
  at: string;
  href: string;
};

const LOOKBACK_DAYS = 30;

// Grievances arrive already stripped of their submitter ref — the type says so.
export async function feedFor(opts: { email: string | null; grievances: Omit<GrievanceRow, "submitterRef">[]; now: number }) {
  const since = new Date(opts.now - LOOKBACK_DAYS * 86_400_000).toISOString();

  const [announcements, events, away, employees] = await Promise.all([
    store.listAnnouncements(10),
    // Every upcoming event, not just the soonest few: a new event further out must still notify
    // (the lookback filter below keeps only recently published or changed ones).
    store.listEvents(new Date(opts.now).toISOString(), 500),
    opts.email ? store.listAwayByEmail(opts.email, 20) : Promise.resolve([]),
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

  // No 'awaiting review' items for admins: leave is approved in Zoho People.

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
      href: leaveHref(),
    });
  }

  // Only things that involve you: kudos you received (never kudos between other people), and the
  // tea round while it's open, you're in the office, and you haven't answered.
  if (opts.email) {
    const email = opts.email;
    const notices = await store.listNotices(100);
    for (const n of notices) {
      if (n.kind !== "kudos" || n.toEmail !== email || n.createdAt < since) continue;
      items.push({ id: `kudos-${n.id}`, kind: "kudos", title: `${(n.authorName || "Someone").split(/\s+/)[0]} gave you kudos`, body: n.body.slice(0, 80), at: n.createdAt, href: "/feed" });
    }
    const today = todayIST();
    const people = await store.listEmployees();
    const first = (e: string) => ((people.find((p) => p.email === e)?.name || e).split(/[\s@]/)[0]);
    for (const h of await store.listHiTo(today, email)) {
      items.push({ id: `hi-${h.id}`, kind: "hi", title: hiTitle(h, first(h.from)), body: "", at: h.createdAt, href: "/notifications", hi: { id: h.id, invite: INVITES.includes(h.kind), reply: h.reply, from: first(h.from) } });
    }
    for (const h of await store.listHiFrom(today, email)) {
      // Dated when they answered, so the answer counts as unread for you.
      if (h.reply) items.push({ id: `hi-reply-${h.id}`, kind: "hi", title: hiReplyTitle(h, first(h.to)), body: "", at: h.repliedAt ?? h.createdAt, href: "/" });
    }
    const times = await snackTimes();
    const round = currentRound(new Date(opts.now), times);
    if (round?.open && (await inOfficeToday(email, today))) {
      const answered = (await store.listTeaAnswers(today)).some((a) => a.round === round.id && a.email === email);
      if (!answered) {
        // Dated from when it became relevant to you: the later of the round starting and your
        // check-in. That makes it unread once (not on every check), even if you looked earlier.
        const roundStart = new Date(`${today}T${round.id === "am" ? "00:00" : times.amAt}:00+05:30`).toISOString();
        const checkIn = (await store.getAttendance(email, today))?.checkInAt ?? roundStart;
        items.push({ id: `tea-${today}-${round.id}`, kind: "tea", title: `Tea round closes at ${clock(round.closesAt)}`, body: `Answer by ${clock(round.closesAt)} for the ${clock(round.at)} round`, at: checkIn > roundStart ? checkIn : roundStart, href: "/snacks" });
      }
    }
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
