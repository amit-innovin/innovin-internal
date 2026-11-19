"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/m3";
import { Lappy } from "@/components/m3/lappy";
import type { FeedPost } from "@/lib/feed";
import { readError, send } from "@/lib/fetcher";
import { useReact, useRsvp, useVote } from "@/lib/queries";

// One Feed card from the prototype: kind chip, who and when, title, body, and one action.
// Counts only (going, votes, appreciations): never who.
export type BirthdayItem = { type: "birthday"; id: string; name: string; email: string; at: string };
export type CardItem = FeedPost | BirthdayItem;

const KIND: Record<string, { label: string; bg: string; color: string }> = {
  announcement: { label: "Announcement", bg: "#CAE6FF", color: "#001E30" },
  event: { label: "Event", bg: "#D3E5F5", color: "#0C1D29" },
  poll: { label: "Poll", bg: "#FFDDB0", color: "#4A2800" },
  kudos: { label: "Kudos", bg: "#FFD9E2", color: "#5C1130" },
  quote: { label: "Quote", bg: "#EBDCFF", color: "#20142F" },
  feedback: { label: "Feedback", bg: "#CDEBD6", color: "#0B3D1F" },
  birthday: { label: "Birthday", bg: "#FFE08A", color: "#3D2E00" },
};

const APPRECIATE = "👍";
const ist = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...o }).format(new Date(iso));
export const when = (iso: string) => {
  const day = (d: Date) => ist(d.toISOString(), { year: "numeric", month: "2-digit", day: "2-digit" });
  const now = new Date();
  if (day(new Date(iso)) === day(now)) return `Today, ${ist(iso, { hour: "numeric", minute: "2-digit" })}`;
  if (day(new Date(iso)) === day(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return ist(iso, { weekday: "short", day: "numeric", month: "short" });
};


const actionStyle = (on: boolean): CSSProperties => ({ alignSelf: "flex-start", height: 40, padding: "0 20px", borderRadius: 20, border: 0, fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: on ? "var(--m3-secondary-container)" : "var(--m3-primary)", color: on ? "var(--m3-on-secondary-container)" : "var(--m3-on-primary)" });

function Appreciate({ post }: { post: Extract<FeedPost, { reactions: unknown }> }) {
  const react = useReact();
  const mine = post.reactions.find((r) => r.emoji === APPRECIATE)?.mine ?? false;
  return <button type="button" aria-pressed={mine} style={actionStyle(mine)} disabled={react.isPending} onClick={() => react.mutate({ id: post.id, emoji: APPRECIATE }, { onError: (e) => toast.error(e.message) })}>{mine ? "Appreciated" : "Appreciate"}</button>;
}

function EventAction({ post }: { post: Extract<FeedPost, { type: "event" }> }) {
  const rsvp = useRsvp();
  if (post.cancelled) return null;
  return <button type="button" aria-pressed={post.mine} style={actionStyle(post.mine)} disabled={rsvp.isPending} onClick={() => rsvp.mutate({ eventId: post.id, going: !post.mine }, { onError: (e) => toast.error(e.message) })}>{post.mine ? "Going" : "I'm in"}</button>;
}

export function PollOptions({ post, compact }: { post: Extract<FeedPost, { type: "poll" }>; compact?: boolean }) {
  const vote = useVote();
  const voted = post.options.some((o) => o.mine);
  return (
    <div role="group" aria-label={post.question} style={{ display: "flex", flexDirection: compact ? "row" : "column", gap: 8 }}>
      {post.options.map((o, i) => (
        <button key={o.label} type="button" aria-pressed={o.mine} disabled={post.closed || vote.isPending} onClick={() => vote.mutate({ id: post.id, vote: o.mine ? null : i }, { onError: (e) => toast.error(e.message) })}
          style={{ position: "relative", overflow: "hidden", height: compact ? 40 : 48, borderRadius: 12, border: o.mine ? "2px solid var(--m3-primary)" : "1px solid #C1C7CE", background: "#FFFFFF", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 15, fontFamily: "inherit", color: "var(--m3-on-surface)", cursor: post.closed ? "default" : "pointer" }}>
          {o.pct !== null && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${o.pct}%`, background: o.mine ? "#CAE6FF" : "#EEF0F3", transition: "width .45s cubic-bezier(.2,.8,.2,1)" }} />}
          <span style={{ position: "relative", fontWeight: o.mine ? 700 : 500 }}>{o.label}</span>
          {o.pct !== null && <span style={{ position: "relative", fontWeight: 600 }}>{o.pct}%</span>}
        </button>
      ))}
      {!compact && <span className="m3-small">{voted || post.closed ? `${post.closed ? "Closed · " : ""}${post.total ?? 0} vote${post.total === 1 ? "" : "s"}` : `Results show after you vote${post.closesAt ? ` · closes ${when(post.closesAt)}` : ""}`}</span>}
    </div>
  );
}

// "Report": quietly tells admins a post may be inappropriate. They see a count, never who.
function ReportPost({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <span className="m3-small">Reported</span>;
  if (!asking) return <button type="button" className="m3-btn m3-btn-text" style={{ alignSelf: "flex-start", height: 28, padding: 0, fontSize: 13, color: "var(--m3-on-surface-variant)" }} onClick={() => setAsking(true)}>Report</button>;
  const report = async () => {
    const res = await send("/api/notices/report", { method: "POST", json: { id } });
    if (!res.ok && res.status !== 409) return toast.error(await readError(res));
    setDone(true);
    toast.success("Reported. An admin will take a look.");
  };
  return (
    <div role="group" aria-label="Report this post" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 12, background: "rgba(255,255,255,.7)" }}>
      <span className="m3-small" style={{ color: "var(--m3-on-surface)" }}>Report this post to admins? They&apos;ll see it was reported, not by whom.</span>
      <span style={{ display: "flex", gap: 8 }}>
        <button type="button" className="m3-btn m3-btn-filled" style={{ height: 32, padding: "0 14px", fontSize: 13 }} onClick={report}>Report post</button>
        <button type="button" className="m3-btn m3-btn-text" style={{ height: 32, padding: "0 10px", fontSize: 13 }} onClick={() => setAsking(false)}>Cancel</button>
      </span>
    </div>
  );
}

export function PostCard({ item, onWish, style, footer }: { item: CardItem; onWish?: (email: string) => void; style?: CSSProperties; footer?: ReactNode }) {
  const kind = KIND[item.type];
  let author: ReactNode = null, title = "", body = "", meta = "", action: ReactNode = null, avatar: ReactNode = null;
  switch (item.type) {
    case "announcement":
      author = `${item.authorName ?? "Admin"} · Admin`; title = item.title; body = item.body; meta = "For everyone"; avatar = <Avatar name={item.authorName ?? "Admin"} />;
      break;
    case "event":
      author = when(item.startsAt); title = item.title; body = [item.body, item.location].filter(Boolean).join(" · "); meta = item.cancelled ? "Cancelled" : "going" in item && typeof item.going === "number" ? `${item.going} going` : ""; action = <EventAction post={item} />;
      break;
    case "poll":
      author = item.authorName ?? "Someone"; title = item.question; action = <PollOptions post={item} />; avatar = <Avatar name={item.authorName ?? "?"} />;
      break;
    case "kudos":
      author = item.fromName ?? "Someone"; title = `Kudos to ${item.toName ?? "someone"}`; body = item.body; meta = `From ${item.fromName ?? "someone"}`; action = <Appreciate post={item} />; avatar = <Avatar name={item.fromName ?? "?"} />;
      break;
    case "quote":
    case "feedback":
      author = item.authorName ?? "Anonymous"; title = item.title; body = item.body; meta = item.type === "quote" && item.attribution ? `— ${item.attribution}` : ""; action = <Appreciate post={item} />; avatar = <Avatar name={item.authorName ?? "?"} />;
      break;
    case "birthday":
      author = "innovin"; title = `It's ${item.name}'s birthday`; body = "Say happy birthday with a kudos."; avatar = <Lappy />;
      action = onWish ? <button type="button" style={actionStyle(false)} onClick={() => onWish(item.email)}>Send a wish</button> : null;
      break;
  }
  const image = (item.type === "quote" || item.type === "feedback") ? item.image : null;
  return (
    <article className="pc" style={style}>
      <div className="pc-head">
        {avatar ?? <span className="pc-glyph" style={{ background: kind.bg, color: kind.color }} aria-hidden="true">{kind.label[0]}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pc-author">{author}</div>
          {item.type !== "event" && <div className="m3-small">{when(item.at)}</div>}
        </div>
        <span className="pc-kind" style={{ background: kind.bg, color: kind.color }}>{kind.label}</span>
      </div>
      {title && <h2 className="pc-title">{title}</h2>}
      {body && <p className="pc-body">{body}</p>}
      {image && <img src={image} alt="" className="pc-img" />}
      <div className="pc-foot">
        {action}
        {(meta || ("reactions" in item && !item.mine)) && (
          <div className="pc-meta">
            {meta && <span className="m3-small">{meta}</span>}
            {"reactions" in item && !item.mine && <ReportPost id={item.id} />}
          </div>
        )}
        {footer}
      </div>
    </article>
  );
}
