// The catch-up Feed's rules (prototype: docs/design/m3/, Feed). Pure, so the server and tests agree.
import { addDays } from "./office-days";

const WEEK_MS = 7 * 86_400_000;

// Someone who has never opened the Feed starts at the beginning of yesterday, office time.
export const defaultSeenAt = (today: string) => new Date(`${addDays(today, -1)}T00:00:00+05:30`).toISOString();

// Posts made after the watermark and within the last week, oldest first. Important announcements
// reach people through their own sheet instead, so they never join the stack, and nothing you
// posted yourself is news to you.
export function newPostIds(posts: { id: string; at: string; type: string; important?: boolean; mine?: boolean }[], seenAt: string, now: number): string[] {
  return posts
    .filter((p) => p.at > seenAt && Date.parse(p.at) >= now - WEEK_MS && !p.mine && !(p.type === "announcement" && p.important))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((p) => p.id);
}

type OpenCandidate =
  | { type: "event"; id: string; mine: boolean; cancelled: boolean; startsAt: string }
  | { type: "poll"; id: string; closed: boolean; options: { mine: boolean }[] }
  | { type: string; id: string };

// Things still waiting for your answer: events you haven't answered that haven't started, and
// open polls you haven't voted in.
export function openItems(posts: OpenCandidate[], now: number): string[] {
  return posts.filter((p) => {
    if (p.type === "event" && "startsAt" in p) return !p.mine && !p.cancelled && Date.parse(p.startsAt) > now;
    if (p.type === "poll" && "options" in p) return !p.closed && !p.options.some((o) => o.mine);
    return false;
  }).map((p) => p.id);
}

type PollNumbers<T> = { closed: boolean; total: number | null; options: (T & { votes: number | null; pct: number | null; mine: boolean })[] };

// Results stay hidden until you've voted (or the poll has closed), so they don't sway your vote.
export function hideUnvoted<T>(poll: PollNumbers<T>): PollNumbers<T> {
  if (poll.closed || poll.options.some((o) => o.mine)) return poll;
  return { ...poll, total: null, options: poll.options.map((o) => ({ ...o, votes: null, pct: null })) };
}

// How one of your own posts reads in "Earlier".
export function myPostLine(post: { type: string; toName?: string | null; question?: string }): string | null {
  if (post.type === "kudos") return `You gave kudos to ${post.toName ?? "someone"}`;
  if (post.type === "poll") return `Your poll: ${post.question ?? ""}`;
  if (post.type === "quote") return "You shared a quote";
  if (post.type === "feedback") return "You shared feedback";
  return null;
}

// Earlier holds everything not in today's stack. An important announcement waits there only
// while its sheet is still due (pinned and not yet acknowledged); once acknowledged, or once its
// pin date has passed unseen, it's listed so nobody loses it.
export function inEarlier(post: { id: string; type: string; important?: boolean; acked?: boolean; pinnedUntil?: string | null }, stackIds: Set<string>, today: string): boolean {
  if (stackIds.has(post.id)) return false;
  const sheetDue = post.type === "announcement" && post.important && !post.acked && !!post.pinnedUntil && post.pinnedUntil >= today;
  return !sheetDue;
}
