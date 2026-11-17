import { describe, expect, it } from "vitest";
import { defaultSeenAt, hideUnvoted, inEarlier, myPostLine, newPostIds, openItems } from "@/lib/feed-rules";

const NOW = Date.parse("2026-11-18T06:00:00Z");
const at = (h: number) => new Date(NOW - h * 3600_000).toISOString();

describe("newPostIds", () => {
  const posts = [
    { id: "old", type: "quote", at: at(8 * 24) },
    { id: "b", type: "kudos", at: at(2) },
    { id: "a", type: "poll", at: at(5) },
    { id: "imp", type: "announcement", at: at(1), important: true },
    { id: "seen", type: "quote", at: at(10) },
  ];
  it("keeps unseen posts from the last 7 days, oldest first, without important announcements", () =>
    expect(newPostIds(posts, at(9), NOW)).toEqual(["a", "b"]));
  it("keeps a post made while you were mid-stack new for next time", () =>
    expect(newPostIds([{ id: "late", type: "quote", at: at(1) }], at(2), NOW)).toEqual(["late"]));
  it("never counts your own posts as new to you", () =>
    expect(newPostIds([{ id: "mine", type: "kudos", at: at(1), mine: true }, { id: "theirs", type: "kudos", at: at(1) }], at(9), NOW)).toEqual(["theirs"]));
  it("starts a first-time reader at the beginning of yesterday, office time", () =>
    expect(defaultSeenAt("2026-11-18")).toBe("2026-11-16T18:30:00.000Z"));
});

describe("openItems", () => {
  const future = new Date(NOW + 86_400_000).toISOString();
  const poll = (id: string, mine: boolean, closed = false) => ({ type: "poll" as const, id, closed, options: [{ mine }, { mine: false }] });
  it("lists unanswered upcoming events and open polls you haven't voted in", () => {
    const posts = [
      { type: "event" as const, id: "e1", mine: false, cancelled: false, startsAt: future },
      { type: "event" as const, id: "e2", mine: true, cancelled: false, startsAt: future },
      { type: "event" as const, id: "e3", mine: false, cancelled: true, startsAt: future },
      { type: "event" as const, id: "e4", mine: false, cancelled: false, startsAt: at(1) },
      poll("p1", false), poll("p2", true), poll("p3", false, true),
      { type: "quote" as const, id: "q" },
    ];
    expect(openItems(posts, NOW)).toEqual(["e1", "p1"]);
  });
});

describe("hideUnvoted", () => {
  const poll = { closed: false, total: 3, options: [{ label: "A", votes: 2, pct: 67, mine: false }, { label: "B", votes: 1, pct: 33, mine: false }] };
  it("hides counts until you vote", () =>
    expect(hideUnvoted(poll)).toEqual({ closed: false, total: null, options: [{ label: "A", votes: null, pct: null, mine: false }, { label: "B", votes: null, pct: null, mine: false }] }));
  it("shows them once you voted or the poll closed", () => {
    const voted = { ...poll, options: [{ ...poll.options[0], mine: true }, poll.options[1]] };
    expect(hideUnvoted(voted)).toEqual(voted);
    expect(hideUnvoted({ ...poll, closed: true })).toEqual({ ...poll, closed: true });
  });
});

describe("myPostLine", () => {
  it("says what you posted", () => {
    expect(myPostLine({ type: "kudos", toName: "Meera" })).toBe("You gave kudos to Meera");
    expect(myPostLine({ type: "poll", question: "Biryani or pizza?" })).toBe("Your poll: Biryani or pizza?");
    expect(myPostLine({ type: "quote" })).toBe("You shared a quote");
    expect(myPostLine({ type: "feedback" })).toBe("You shared feedback");
    expect(myPostLine({ type: "event" })).toBeNull();
  });
});

describe("inEarlier", () => {
  const imp = (extra: object) => ({ id: "i", type: "announcement", important: true, acked: false, pinnedUntil: "2026-11-20", ...extra });
  it("keeps posts in the stack out of Earlier", () => expect(inEarlier({ id: "a", type: "quote" }, new Set(["a"]), "2026-11-18")).toBe(false));
  it("holds back an important announcement only while its sheet is still due", () => {
    expect(inEarlier(imp({}), new Set(), "2026-11-18")).toBe(false);
    expect(inEarlier(imp({ acked: true }), new Set(), "2026-11-18")).toBe(true);
    // Its pin date passed before this person saw it: it must still be findable.
    expect(inEarlier(imp({ pinnedUntil: "2026-11-17" }), new Set(), "2026-11-18")).toBe(true);
  });
});
