// Everything on the Feed, newest first, with recent announcements pinned on top.
import { celebrationsFor, pollResults } from "./member-features";
import { noticeBoard, type PublicNotice } from "./notices";
import { store } from "./store";
import { accountRef } from "./submitter";
import { todayIST } from "./time";

const PIN_DAYS = 14;

type Reactions = PublicNotice["reactions"];
export type FeedPost =
  | { type: "announcement"; id: string; title: string; body: string; tag: string; at: string; pinned: boolean }
  | { type: "event"; id: string; title: string; body: string; category: string; startsAt: string; location: string; going: number; mine: boolean; cancelled: boolean; at: string }
  | { type: "quote" | "feedback"; id: string; title: string; body: string; color: string; authorName: string | null; anonymous: boolean; image: string | null; at: string; reactions: Reactions }
  | { type: "kudos"; id: string; body: string; fromName: string | null; toName: string | null; at: string; reactions: Reactions }
  | { type: "poll"; id: string; question: string; authorName: string | null; closesAt: string | null; closed: boolean; total: number; options: { label: string; votes: number; pct: number; mine: boolean }[]; at: string; reactions: Reactions };

export async function feedFor(viewer: string) {
  const now = Date.now();
  const [notices, announcements, events, employees] = await Promise.all([
    noticeBoard(viewer),
    store.listAnnouncements(20),
    store.listEvents(new Date(now - 12 * 3600_000).toISOString(), 30),
    store.listEmployees(),
  ]);
  const polls = notices.filter((n) => n.kind === "poll");
  const [votes, counts, mine] = await Promise.all([
    store.listPollVotes(polls.map((p) => p.id)),
    store.rsvpCounts(events.map((e) => e.id)),
    store.myRsvpEventIds(accountRef(`rsvp:${viewer}`), viewer),
  ]);
  const myEvents = new Set(mine);

  const posts: FeedPost[] = [
    ...announcements.map((a) => ({ type: "announcement" as const, id: a.id, title: a.title, body: a.body, tag: a.tag, at: a.createdAt, pinned: now - Date.parse(a.createdAt) < PIN_DAYS * 86_400_000 })),
    ...events.map((e) => ({ type: "event" as const, id: e.id, title: e.title, body: e.body, category: e.category, startsAt: e.startsAt, location: e.location, going: counts[e.id] ?? 0, mine: myEvents.has(e.id), cancelled: !!e.cancelledAt, at: e.createdAt })),
    ...notices.map((n): FeedPost => {
      if (n.kind === "poll") {
        const results = pollResults(n.options ?? [], votes.filter((v) => v.noticeId === n.id), viewer);
        return { type: "poll", id: n.id, question: n.title, authorName: n.authorName, closesAt: n.closesAt ?? null, closed: !!n.closesAt && Date.parse(n.closesAt) < now, ...results, at: n.createdAt, reactions: n.reactions };
      }
      if (n.kind === "kudos") return { type: "kudos", id: n.id, body: n.body, fromName: n.authorName, toName: n.toName ?? null, at: n.createdAt, reactions: n.reactions };
      return { type: n.kind, id: n.id, title: n.title, body: n.body, color: n.color, authorName: n.anonymous ? null : n.authorName, anonymous: n.anonymous, image: n.image ?? null, at: n.createdAt, reactions: n.reactions };
    }),
  ];
  const pinned = (p: FeedPost) => p.type === "announcement" && p.pinned;
  posts.sort((a, b) => Number(pinned(b)) - Number(pinned(a)) || b.at.localeCompare(a.at));

  const people = employees.filter((e) => e.email !== viewer).map((e) => ({ email: e.email, name: e.name || e.email }));
  return { posts, celebrations: celebrationsFor(employees, todayIST()), people };
}
// What /api/feed returns: the feed plus whether the viewer can remove posts.
export type Feed = Awaited<ReturnType<typeof feedFor>> & { canModerate: boolean };
