// Everything on the Feed, newest first, plus what's new for the viewer (the catch-up stack) and
// what's still waiting for their answer.
import { defaultSeenAt, hideUnvoted, newPostIds, openItems } from "./feed-rules";
import { celebrationsFor, pollResults } from "./member-features";
import { noticeBoard, type PublicNotice } from "./notices";
import { store } from "./store";
import { accountRef } from "./submitter";
import { todayIST } from "./time";

const PIN_DAYS = 14;

type Reactions = PublicNotice["reactions"];
export type FeedPost =
  | { type: "announcement"; id: string; title: string; body: string; tag: string; at: string; pinned: boolean; important: boolean; authorName: string | null; pinnedUntil: string | null; acked: boolean }
  | { type: "event"; id: string; title: string; body: string; category: string; startsAt: string; location: string; going: number; mine: boolean; cancelled: boolean; at: string }
  | { type: "quote" | "feedback"; id: string; title: string; body: string; attribution: string; color: string; authorName: string | null; anonymous: boolean; image: string | null; at: string; reactions: Reactions; mine: boolean }
  | { type: "kudos"; id: string; body: string; fromName: string | null; toName: string | null; at: string; reactions: Reactions; mine: boolean }
  // total, votes and pct are null until the viewer has voted or the poll has closed.
  | { type: "poll"; id: string; question: string; authorName: string | null; closesAt: string | null; closed: boolean; total: number | null; options: { label: string; votes: number | null; pct: number | null; mine: boolean }[]; at: string; reactions: Reactions; mine: boolean };

export async function feedFor(viewer: string) {
  const now = Date.now();
  const today = todayIST();
  const [notices, announcements, events, employees, acked] = await Promise.all([
    noticeBoard(viewer),
    store.listAnnouncements(20),
    store.listEvents(new Date(now - 12 * 3600_000).toISOString(), 30),
    store.listEmployees(),
    store.listAckedAnnouncementIds(viewer),
  ]);
  const polls = notices.filter((n) => n.kind === "poll");
  const [votes, counts, mine] = await Promise.all([
    store.listPollVotes(polls.map((p) => p.id)),
    store.rsvpCounts(events.map((e) => e.id)),
    store.myRsvpEventIds(accountRef(`rsvp:${viewer}`), viewer),
  ]);
  const myEvents = new Set(mine);
  const ackedIds = new Set(acked);

  const posts: FeedPost[] = [
    ...announcements.map((a) => ({
      type: "announcement" as const, id: a.id, title: a.title, body: a.body, tag: a.tag, at: a.createdAt,
      important: !!a.important, authorName: a.authorName ?? null, pinnedUntil: a.pinnedUntil ?? null, acked: ackedIds.has(a.id),
      pinned: a.important ? !!a.pinnedUntil && a.pinnedUntil >= today : now - Date.parse(a.createdAt) < PIN_DAYS * 86_400_000,
    })),
    ...events.map((e) => ({ type: "event" as const, id: e.id, title: e.title, body: e.body, category: e.category, startsAt: e.startsAt, location: e.location, going: counts[e.id] ?? 0, mine: myEvents.has(e.id), cancelled: !!e.cancelledAt, at: e.createdAt })),
    ...notices.map((n): FeedPost => {
      if (n.kind === "poll") {
        const closed = !!n.closesAt && Date.parse(n.closesAt) < now;
        const results = hideUnvoted({ closed, ...pollResults(n.options ?? [], votes.filter((v) => v.noticeId === n.id), viewer) });
        return { type: "poll", id: n.id, question: n.title, authorName: n.authorName, closesAt: n.closesAt ?? null, ...results, at: n.createdAt, reactions: n.reactions, mine: n.mine };
      }
      if (n.kind === "kudos") return { type: "kudos", id: n.id, body: n.body, fromName: n.authorName, toName: n.toName ?? null, at: n.createdAt, reactions: n.reactions, mine: n.mine };
      return { type: n.kind, id: n.id, title: n.title, body: n.body, attribution: n.attribution ?? "", color: n.color, authorName: n.anonymous ? null : n.authorName, anonymous: n.anonymous, image: n.image ?? null, at: n.createdAt, reactions: n.reactions, mine: n.mine };
    }),
  ];
  const pinned = (p: FeedPost) => p.type === "announcement" && p.pinned;
  posts.sort((a, b) => Number(pinned(b)) - Number(pinned(a)) || b.at.localeCompare(a.at));

  const me = employees.find((e) => e.email === viewer);
  const seenAt = me?.feedSeenAt ?? defaultSeenAt(today);
  const people = employees.filter((e) => e.email !== viewer).map((e) => ({ email: e.email, name: e.name || e.email })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    posts,
    seenAt,
    // The catch-up stack, oldest first. Important announcements come through their own sheet.
    newIds: newPostIds(posts.map((p) => ({ id: p.id, at: p.at, type: p.type, important: p.type === "announcement" && p.important, mine: "reactions" in p && p.mine })), seenAt, now),
    open: openItems(posts, now),
    celebrations: celebrationsFor(employees, today),
    people,
  };
}
// What /api/feed returns: the feed plus whether the viewer can remove posts.
export type Feed = Awaited<ReturnType<typeof feedFor>> & { canModerate: boolean };
