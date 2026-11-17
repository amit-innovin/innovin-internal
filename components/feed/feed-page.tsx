"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, QueryState } from "@/components/m3";
import { PageHero } from "@/components/m3/hero";
import { Sheet } from "@/components/m3/sheet";
import type { FeedPost } from "@/lib/feed";
import { myPostLine } from "@/lib/feed-rules";
import { useFeed, useMarkFeedSeen, useRemoveNotice, useRsvp } from "@/lib/queries";
import { CatchUp } from "./catch-up";
import { Composer, type Kind } from "./composer";
import { PollOptions, PostCard, when, type BirthdayItem, type CardItem } from "./post-card";

const KIND_WORD: Record<FeedPost["type"], string> = { announcement: "Announcement", event: "Event", poll: "Poll", kudos: "Kudos", quote: "Quote", feedback: "Feedback" };

function rowText(post: FeedPost): { title: string; sub: string } {
  const mine = post.type !== "announcement" && post.type !== "event" && post.mine ? myPostLine(post.type === "poll" ? { type: "poll", question: post.question } : post) : null;
  const title = mine ?? (post.type === "announcement" ? `${post.authorName ? `${post.authorName}: ` : ""}${post.title}`
    : post.type === "event" ? post.title
    : post.type === "poll" ? post.question
    : post.type === "kudos" ? `Kudos to ${post.toName ?? "someone"} from ${post.fromName ?? "someone"}`
    : post.image ? `${post.authorName ?? "Someone"} posted a photo` : post.title || post.body.slice(0, 80));
  const sub = post.type === "announcement" && post.important && post.acked
    ? `Important${post.pinnedUntil ? ` · pinned until ${when(`${post.pinnedUntil}T12:00:00+05:30`)}` : ""} · you've seen it`
    : `${KIND_WORD[post.type]} · ${when(post.at)}`;
  return { title, sub };
}

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1100px)");
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
}

function StillOpen({ posts }: { posts: FeedPost[] }) {
  const rsvp = useRsvp();
  return (
    <section aria-labelledby="feed-open" className="m3-stack" style={{ gap: 8 }}>
      <h2 id="feed-open" className="m3-title" style={{ padding: "6px 4px 0" }}>Still open</h2>
      <div className="m3-card" style={{ padding: 0, overflow: "hidden" }}>
        {posts.length === 0 ? <p className="m3-small" style={{ margin: 0, padding: 16 }}>Nothing waiting. Nice.</p> : posts.map((p) => (
          <div key={p.id} className="m3-row" style={{ flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column" }}>
              <span>{p.type === "poll" ? p.question : p.type === "event" ? p.title : ""}</span>
              <span className="m3-small">{p.type === "event" ? `Starts ${when(p.startsAt)}` : p.type === "poll" && p.closesAt ? `Closes ${when(p.closesAt)}` : ""}</span>
            </span>
            {p.type === "event" && <Button variant="outlined" disabled={rsvp.isPending} onClick={() => rsvp.mutate({ eventId: p.id, going: true }, { onError: (e) => toast.error(e.message) })}>I&apos;m in</Button>}
            {p.type === "poll" && <PollOptions post={p} compact />}
          </div>
        ))}
      </div>
    </section>
  );
}

function Earlier({ posts, canModerate, onWish }: { posts: FeedPost[]; canModerate: boolean; onWish: (email: string) => void }) {
  const [open, setOpen] = useState<FeedPost | null>(null);
  const remove = useRemoveNotice();
  const removable = open && open.type !== "announcement" && open.type !== "event" && (open.mine || canModerate);
  return (
    <section aria-labelledby="feed-earlier" className="m3-stack" style={{ gap: 8 }}>
      <h2 id="feed-earlier" className="m3-title" style={{ padding: "6px 4px 0" }}>Earlier</h2>
      <div className="m3-card" style={{ padding: 0, overflow: "hidden" }}>
        {posts.length === 0 ? <p className="m3-small" style={{ margin: 0, padding: 16 }}>Nothing older yet.</p> : posts.slice(0, 30).map((p) => {
          const { title, sub } = rowText(p);
          const who = p.type === "kudos" ? p.fromName : p.type === "announcement" ? p.authorName : p.type === "event" ? null : p.authorName;
          return (
            <button key={p.id} type="button" className="m3-row" onClick={() => setOpen(p)}>
              <Avatar name={who ?? "innovin"} size={36} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", textAlign: "left" }}><span style={{ overflowWrap: "anywhere" }}>{title}</span><span className="m3-small">{sub}</span></span>
            </button>
          );
        })}
      </div>
      {open && (
        <Sheet open onClose={() => setOpen(null)} label="Post">
          <PostCard item={open} onWish={onWish} style={{ boxShadow: "none" }}
            footer={removable ? <Button variant="text" style={{ alignSelf: "flex-start" }} disabled={remove.isPending} onClick={() => remove.mutate({ id: open.id }, { onSuccess: () => { toast.success("Post removed"); setOpen(null); }, onError: (e) => toast.error(e.message) })}>Remove post</Button> : null} />
        </Sheet>
      )}
    </section>
  );
}

// The catch-up Feed from the Material 3 prototype: what's new since you last looked, one card at a
// time on phones (all at once on a laptop), then what's still waiting for your answer, then the rest.
export function FeedPage() {
  const feed = useFeed();
  const wide = useWide();
  const [index, setIndex] = useState(0);
  const [compose, setCompose] = useState<{ kind?: Kind; to?: string } | null>(null);
  const data = feed.data;

  // Which cards are in the stack, and their order, is fixed when the page first loads, so answering
  // a card (which refetches) or the watermark moving never reshuffles what the person is reading.
  // Each card still shows the latest data for its post.
  const [frozen, setFrozen] = useState<{ ids: string[]; birthdays: BirthdayItem[] } | null>(null);
  useEffect(() => {
    if (!data || frozen) return;
    const birthdays: BirthdayItem[] = data.celebrations.filter((c) => c.today && c.type === "birthday").map((c): BirthdayItem => ({ type: "birthday", id: `bday-${c.id}`, name: c.name, email: c.email, at: new Date(`${c.date.slice(0, 10)}T00:00:00+05:30`).toISOString() })).filter((b) => b.at > data.seenAt);
    setFrozen({ ids: data.newIds, birthdays });
  }, [data, frozen]);
  const stack = useMemo<CardItem[]>(() => {
    if (!data || !frozen) return [];
    const byId = new Map(data.posts.map((p) => [p.id, p]));
    const posts = frozen.ids.map((id) => byId.get(id)).filter((p): p is FeedPost => !!p);
    return [...posts, ...frozen.birthdays].sort((a, b) => a.at.localeCompare(b.at));
  }, [data, frozen]);

  if (!data || !frozen) return <div className="m3 m3-page m3-stack"><PageHero page="feed" title="Feed" /><QueryState error={feed.error} onRetry={() => feed.refetch()} what="the feed" /></div>;

  const stackIds = new Set(stack.map((s) => s.id));
  const open = data.open.map((id) => data.posts.find((p) => p.id === id)).filter((p): p is FeedPost => !!p);
  const earlier = data.posts.filter((p) => !stackIds.has(p.id) && !(p.type === "announcement" && p.important && !p.acked));
  const inStack = !wide && index < stack.length;
  const waiting = open.length;
  const wish = (email: string) => setCompose({ kind: "kudos", to: email });

  return (
    <div className="m3 m3-page m3-stack">
      <PageHero page="feed" title="Feed"
        subtitle={inStack ? `${index + 1} of ${stack.length} new since yesterday` : wide && stack.length ? "New posts first, then everything else" : "Nothing new since yesterday"}
        actions={<Button variant="tonal" onClick={() => setCompose({})}><Plus size={18} aria-hidden="true" />Post</Button>} />
      {inStack && <CatchUp items={stack} index={index} onIndex={setIndex} seenAt={data.seenAt} onWish={wish} />}
      {wide && stack.length > 0 && (
        <section aria-label="New posts" className="m3-stack">
          <span className="m3-small" style={{ fontWeight: 700, letterSpacing: ".06em" }}>NEW SINCE YESTERDAY · {stack.length}</span>
          {stack.map((item) => <PostCard key={item.id} item={item} onWish={wish} />)}
          <WideSeen at={stack[stack.length - 1].at} seenAt={data.seenAt} />
        </section>
      )}
      {!inStack && (
        <Card className="m3-stack" style={{ alignItems: "center", textAlign: "center", padding: "28px 24px", gap: 10 }}>
          <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 28, background: "var(--m3-success-container)", color: "var(--m3-on-success-container)", display: "grid", placeItems: "center" }}><Check size={28} /></span>
          <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>You&apos;re all caught up</h2>
          <p className="m3-body" style={{ margin: 0 }}>{waiting ? `You've seen everything new. ${waiting === 1 ? "1 thing is" : `${waiting} things are`} still waiting for an answer.` : "You've seen and answered everything new. Older posts are below."}</p>
          {!wide && stack.length > 0 && <Button variant="outlined" onClick={() => setIndex(0)}>Start over</Button>}
        </Card>
      )}
      {!inStack && <StillOpen posts={open} />}
      <Earlier posts={earlier} canModerate={data.canModerate} onWish={wish} />
      {compose && <Composer people={data.people} start={compose.kind ? { kind: compose.kind, to: compose.to } : undefined} onClose={() => setCompose(null)} />}
    </div>
  );
}

// On a laptop every new post is on screen at once, so they're all seen as soon as they show.
function WideSeen({ at, seenAt }: { at: string; seenAt: string }) {
  const [done, setDone] = useState(false);
  const markSeen = useMarkFeedSeen().mutate;
  useEffect(() => { if (!done && at > seenAt) { setDone(true); markSeen(at); } }, [at, seenAt, done, markSeen]);
  return null;
}
