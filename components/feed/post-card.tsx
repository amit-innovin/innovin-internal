"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/m3";
import { Lappy } from "@/components/m3/lappy";
import type { FeedPost } from "@/lib/feed";
import type { Celebration } from "@/lib/member-features";
import { readError, send } from "@/lib/fetcher";
import { useReact, useRsvp, useVote } from "@/lib/queries";

// One Feed card from the prototype: kind chip, who and when, title, body, and one action.
// Counts only (going, votes, appreciations): never who.
export type BirthdayItem = { type: "birthday"; id: string; name: string; email: string; at: string };
export type CardItem = FeedPost | BirthdayItem;

const KIND: Record<string, { label: string; bg: string; color: string; card: string; tint: string }> = {
  announcement: { label: "Announcement", bg: "#CAE6FF", color: "#001E30", card: "#F2F8FD", tint: "#CAE6FF" },
  event: { label: "Event", bg: "#D3E5F5", color: "#0C1D29", card: "#F3F6FF", tint: "#D3E5F5" },
  poll: { label: "Poll", bg: "#FFDDB0", color: "#4A2800", card: "#FFF7EC", tint: "#FFDDB0" },
  kudos: { label: "Kudos", bg: "#FFD9E2", color: "#5C1130", card: "#FFF4F6", tint: "#FFD9E2" },
  quote: { label: "Quote", bg: "#EBDCFF", color: "#20142F", card: "#F8F4FF", tint: "#EBDCFF" },
  feedback: { label: "Feedback", bg: "#CDEBD6", color: "#0B3D1F", card: "#F2FAF4", tint: "#CDEBD6" },
  birthday: { label: "Birthday", bg: "#FFE08A", color: "#3D2E00", card: "#FFFAEB", tint: "#FFE08A" },
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


const actionStyle = (on: boolean): CSSProperties => ({ alignSelf: "flex-start", height: 44, padding: "0 20px", borderRadius: 22, border: 0, fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: on ? "var(--m3-secondary-container)" : "var(--m3-primary)", color: on ? "var(--m3-on-secondary-container)" : "var(--m3-on-primary)" });

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
    <article style={{ background: `radial-gradient(circle at 100% 0, ${kind.tint} 0 92px, ${kind.card} 93px)`, borderRadius: 28, padding: 20, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.08)", ...style }}>
      <span style={{ alignSelf: "flex-start", height: 26, padding: "0 10px", borderRadius: 8, background: kind.bg, color: kind.color, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>{kind.label}</span>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {avatar}
        <div><div style={{ fontSize: 15, fontWeight: 600 }}>{author}</div>{item.type !== "event" && <div className="m3-small">{when(item.at)}</div>}</div>
      </div>
      {title && <h2 style={{ margin: 0, fontSize: 21, lineHeight: "28px", fontWeight: 600 }}>{title}</h2>}
      {body && <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", color: "#2B3036", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{body}</p>}
      {image && <img src={image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 16 }} />}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {action}
        {meta && <span className="m3-small">{meta}</span>}
        {"reactions" in item && !item.mine && <ReportPost id={item.id} />}
        {footer}
      </div>
    </article>
  );
}
