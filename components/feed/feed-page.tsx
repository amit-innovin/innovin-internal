"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Cake, CalendarDays, Camera, Check, ChevronRight, Heart, Laugh, Megaphone, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Flat, PageHeader, Pill, type Tone } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Lappy } from "@/components/duo/lappy";
import { Sheet } from "@/components/duo/sheet";
import { relativeTime } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { useFeed, useSend, type Feed, type FeedPost } from "@/lib/queries";

const IST = "Asia/Kolkata";
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...o }).format(new Date(iso));
// Stored note colours → Duo Pop tones.
const TONE: Record<string, Tone> = { yellow: "gold", blue: "sky", green: "green", purple: "grape", peach: "pink" };
const COLOR_FOR: Record<string, string> = { gold: "yellow", sky: "blue", green: "green", grape: "purple" };
const REACTIONS = [{ emoji: "❤️", label: "Love", Icon: Heart }, { emoji: "💡", label: "Brilliant", Icon: Sparkles }, { emoji: "😂", label: "Haha", Icon: Laugh }] as const;

const FILTERS = [["all", "All"], ["event", "Events"], ["poll", "Polls"], ["kudos", "Kudos"], ["announcement", "Announcements"], ["celebration", "Celebrations"], ["photo", "Photos"], ["quote", "Quotes"], ["feedback", "Feedback"]] as const;
type Filter = (typeof FILTERS)[number][0];
const matches = (p: FeedPost, f: Filter) => f === "all" || (f === "photo" ? (p.type === "quote" || p.type === "feedback") && !!p.image : p.type === f);

export type Compose = { kind: "quote" | "feedback" | "kudos" | "poll"; to?: string; text?: string };

function ReactionRow({ post, dark }: { post: Extract<FeedPost, { reactions: unknown }>; dark?: boolean }) {
  const react = useSend<{ id: string; emoji: string }>(["feed"], "/api/notices", "PATCH");
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {REACTIONS.map(({ emoji, label, Icon }) => {
        const r = post.reactions.find((x) => x.emoji === emoji);
        const mine = !!r?.mine, n = r?.count ?? 0;
        return (
          <button key={emoji} type="button" aria-pressed={mine} aria-label={`${mine ? "Remove your" : "React"} ${label}, ${n}`} disabled={react.isPending}
            onClick={() => react.mutate({ id: post.id, emoji }, { onError: (e) => toast.error(e.message) })}
            style={{ cursor: "pointer", height: 36, minWidth: 44, padding: "0 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--duo-display)", fontSize: 14, fontWeight: 600, border: `2px solid ${mine ? (dark ? "#fff" : "currentColor") : "transparent"}`, background: dark ? (mine ? "#fff" : "rgba(255,255,255,.14)") : mine ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.55)", color: dark ? (mine ? "var(--duo-hero)" : "#fff") : "inherit" }}>
            <Icon size={16} fill={mine && emoji === "❤️" ? "currentColor" : "none"} aria-hidden="true" />{n}
          </button>
        );
      })}
    </div>
  );
}

function RemoveButton({ id, label }: { id: string; label: string }) {
  const remove = useSend<{ id: string }>(["feed"], "/api/notices", "DELETE");
  return (
    <button type="button" aria-label={`Remove ${label}`} className="duo-btn duo-btn-text" style={{ minHeight: 36, padding: "0 6px", color: "inherit", opacity: 0.8 }}
      onClick={() => { if (window.confirm("Remove this post for everyone?")) remove.mutate({ id }, { onSuccess: () => toast.success("Post removed"), onError: (e) => toast.error(e.message) }); }}>
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span className="duo-tag" style={color ? { color } : undefined}>{children}</span>;
}

function EventCard({ post }: { post: Extract<FeedPost, { type: "event" }> }) {
  const rsvp = useSend<{ eventId: string; going: boolean }>(["feed"], "/api/events", "PATCH");
  const past = Date.parse(post.startsAt) < Date.now();
  return (
    <Card id={`event-${post.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
      <span className="duo-tone-grape" style={{ width: 46, height: 50, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "var(--duo-display)" }} aria-hidden="true">
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{fmt(post.startsAt, { day: "numeric" })}</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{fmt(post.startsAt, { month: "short" })}</span>
      </span>
      <Link href={`/feed/events/${post.id}`} style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <Tag>Event · {post.category}</Tag>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600, lineHeight: 1.2, textDecoration: post.cancelled ? "line-through" : undefined }}>{post.title}</span>
        <span className="duo-sub" style={{ fontSize: 13 }}>{post.cancelled ? "Cancelled" : `${fmt(post.startsAt, { weekday: "short", hour: "numeric", minute: "2-digit" })} · ${post.going} going`}</span>
      </Link>
      {!post.cancelled && !past && (
        <Button variant={post.mine ? "ghost" : "primary"} aria-pressed={post.mine} disabled={rsvp.isPending} style={{ minHeight: 44 }}
          onClick={() => rsvp.mutate({ eventId: post.id, going: !post.mine }, { onError: (e) => toast.error(e.message) })}>
          {post.mine ? <><Check size={16} aria-hidden="true" />Going</> : "I'm in"}
        </Button>
      )}
      <Link href={`/feed/events/${post.id}`} className="duo-btn duo-btn-g duo-btn-icon" style={{ width: 44, minHeight: 44 }} aria-label={`${post.title}, details`}><ChevronRight size={18} aria-hidden="true" /></Link>
    </Card>
  );
}

function PollCard({ post, canModerate }: { post: Extract<FeedPost, { type: "poll" }>; canModerate: boolean }) {
  const vote = useSend<{ id: string; vote: number | null }>(["feed"], "/api/notices", "PATCH");
  const picked = post.options.findIndex((o) => o.mine);
  return (
    <Card id={`post-${post.id}`} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={post.authorName ?? "?"} size={36} />
        <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{post.authorName ?? "Someone"}</span>
          <Tag>Poll · {post.closed ? "closed" : post.closesAt ? `closes ${fmt(post.closesAt, { weekday: "short", day: "numeric", month: "short" })}` : "open"}</Tag>
        </span>
        <span className="duo-sub" style={{ fontSize: 12 }}>{relativeTime(post.at)}</span>
        {canModerate && <RemoveButton id={post.id} label="poll" />}
      </div>
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>{post.question}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }} role="group" aria-label={post.question}>
        {post.options.map((o, i) => (
          <button key={o.label} type="button" aria-pressed={o.mine} disabled={post.closed || vote.isPending}
            onClick={() => vote.mutate({ id: post.id, vote: o.mine ? null : i }, { onError: (e) => toast.error(e.message) })}
            style={{ cursor: post.closed ? "default" : "pointer", position: "relative", overflow: "hidden", minHeight: 46, borderRadius: 14, background: "#fff", border: `2.5px solid ${o.mine ? "var(--duo-primary)" : "var(--duo-line)"}`, boxShadow: post.closed ? "none" : `0 4px 0 ${o.mine ? "var(--duo-primary-edge)" : "var(--duo-line)"}`, display: "flex", alignItems: "center", padding: "0 14px", fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600, color: "var(--duo-ink)", textAlign: "left" }}>
            <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${picked >= 0 || post.closed ? o.pct : 0}%`, background: o.mine ? "var(--duo-sky)" : "var(--duo-soft)", transition: "width .4s" }} />
            <span style={{ position: "relative", flexGrow: 1 }}>{o.label}</span>
            {(picked >= 0 || post.closed) && <span style={{ position: "relative" }}>{o.pct}%</span>}
          </button>
        ))}
      </div>
      <span className="duo-sub" style={{ fontSize: 12 }}>{post.total} vote{post.total === 1 ? "" : "s"}{picked >= 0 ? ` · you picked ${post.options[picked].label}` : post.closed ? "" : " · tap to vote, tap again to take it back"}</span>
      <ReactionRow post={post} />
    </Card>
  );
}

function NoteCard({ post, canModerate }: { post: Extract<FeedPost, { type: "quote" | "feedback" }>; canModerate: boolean }) {
  const tone = TONE[post.color] ?? "gold";
  return (
    <div id={`post-${post.id}`} className={`duo-tone-${tone}`} style={{ borderRadius: 22, padding: 16, display: "flex", flexDirection: "column", gap: 8, border: `2.5px solid var(--duo-${tone === "sky" ? "sky-edge" : tone === "soft" ? "line" : `${tone}-edge`})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Tag color="inherit">{post.image ? "Photo · " : ""}{post.type === "quote" ? "Quote" : "Feedback"}</Tag>
        <span style={{ flexGrow: 1 }} />
        {canModerate && <RemoveButton id={post.id} label="note" />}
      </div>
      {post.image && <img src={post.image} alt={post.title || "Photo shared on the feed"} style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16 }} />}
      {post.title && <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 700 }}>{post.title}</span>}
      <span style={{ fontFamily: post.type === "quote" ? "var(--duo-display)" : undefined, fontSize: post.type === "quote" ? 19 : 15, fontWeight: post.type === "quote" ? 600 : 700, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{post.type === "quote" ? `“${post.body}”` : post.body}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Avatar name={post.authorName ?? "Anonymous"} size={28} />
        <span style={{ fontSize: 13, fontWeight: 800, flexGrow: 1 }}>{post.authorName ?? "Anonymous teammate"} · {relativeTime(post.at)}</span>
        <ReactionRow post={post} />
      </div>
    </div>
  );
}

function KudosCard({ post, canModerate }: { post: Extract<FeedPost, { type: "kudos" }>; canModerate: boolean }) {
  return (
    <div id={`post-${post.id}`} className="duo-tone-grape" style={{ border: "2.5px solid var(--duo-grape-edge)", borderRadius: 22, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center" }}><Tag color="inherit">Kudos</Tag><span style={{ flexGrow: 1 }} />{canModerate && <RemoveButton id={post.id} label="kudos" />}</div>
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 19, fontWeight: 700 }}>{(post.fromName ?? "Someone").split(" ")[0]} → {(post.toName ?? "someone").split(" ")[0]}</span>
      <span style={{ fontSize: 15, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{post.body}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, flexGrow: 1 }}>{relativeTime(post.at)}</span>
        <ReactionRow post={post} />
      </div>
    </div>
  );
}

function AnnouncementCard({ post }: { post: Extract<FeedPost, { type: "announcement" }> }) {
  return (
    <div id={`announcement-${post.id}`} style={{ background: "var(--duo-hero)", color: "#fff", borderRadius: 22, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="duo-tile" style={{ background: "var(--duo-gold)", color: "var(--duo-ink)", transform: "rotate(-6deg)" }} aria-hidden="true"><Megaphone size={20} /></span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <Tag color="var(--duo-gold)">Announcement{post.pinned ? " · pinned" : ""}{post.tag ? ` · ${post.tag}` : ""}</Tag>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 20, fontWeight: 700 }}>{post.title}</span>
        </span>
      </div>
      {post.body && <span style={{ fontSize: 15, color: "var(--duo-hero-muted)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{post.body}</span>}
      <span style={{ fontSize: 12, color: "var(--duo-hero-muted)" }}>{relativeTime(post.at)}</span>
    </div>
  );
}

function CelebrationCard({ c, onWish }: { c: Feed["celebrations"][number]; onWish: () => void }) {
  const when = c.today ? "today" : fmt(`${c.date}T12:00:00+05:30`, { weekday: "long" });
  const title = c.type === "birthday" ? (c.today ? `Happy birthday, ${c.name}!` : `${c.name}'s birthday`) : `${c.years} year${c.years === 1 ? "" : "s"} at Innovin, ${c.name}`;
  return (
    <div className="duo-tone-pink" style={{ border: "2.5px solid var(--duo-pink-edge)", borderRadius: 22, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <span className="duo-tile" style={{ background: "#fff", width: 44, height: 44 }} aria-hidden="true"><Cake size={22} /></span>
      <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <Tag color="inherit">{c.type === "birthday" ? "Birthday" : "Work anniversary"} · {when}</Tag>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 700 }}>{title}</span>
      </span>
      <Button variant="ghost" style={{ color: "var(--duo-pink-text)", borderColor: "var(--duo-pink-edge)", boxShadow: "0 4px 0 var(--duo-pink-edge)" }} onClick={onWish}><Heart size={16} aria-hidden="true" />Send wishes</Button>
    </div>
  );
}

const KIND_LABEL = { quote: "Quote", feedback: "Feedback", kudos: "Kudos", poll: "Poll" } as const;
const istDay = (offset: number) => new Date(Date.now() + 5.5 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10);

export function NewPostSheet({ start, people, onClose }: { start: Compose; people: Feed["people"]; onClose: () => void }) {
  const [kind, setKind] = useState(start.kind);
  const [text, setText] = useState(start.text ?? "");
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState<"gold" | "sky" | "green" | "grape">("gold");
  const [anonymous, setAnonymous] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [to, setTo] = useState(start.to ?? "");
  const [options, setOptions] = useState(["", ""]);
  const [closes, setCloses] = useState(3);
  const post = useSend<Record<string, unknown>>(["feed"], "/api/notices", "POST");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = kind === "kudos" ? { kind, toEmail: to, body: text }
      : kind === "poll" ? { kind, title, options: options.map((o) => o.trim()).filter(Boolean), closesOn: istDay(closes) }
      : { kind, body: text, color: COLOR_FOR[tone], anonymous, image };
    post.mutate(body, { onSuccess: () => { toast.success("Posted to the feed"); onClose(); }, onError: (err) => toast.error(err.message) });
  };
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try { setImage(await compressImage(file)); } catch { toast.error("That photo couldn't be used. Try a smaller JPEG or PNG."); }
  };

  return (
    <Sheet label="New post" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2 className="duo-h2" style={{ fontSize: 22, flexGrow: 1 }}>New post</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="duo-btn duo-btn-icon" style={{ width: 40, minHeight: 40, background: "var(--duo-soft)" }}><X size={18} aria-hidden="true" /></button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="radiogroup" aria-label="Kind of post">
          {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} aria-pressed={kind === k} className="duo-chip" onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>

        {(kind === "quote" || kind === "feedback") && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="duo-label">Colour</span>
              {(["gold", "sky", "green", "grape"] as const).map((t) => (
                <button key={t} type="button" aria-label={`${t} note`} aria-pressed={tone === t} onClick={() => setTone(t)} className={`duo-tone-${t}`}
                  style={{ cursor: "pointer", width: 36, height: 36, borderRadius: 12, border: `3px solid ${tone === t ? "var(--duo-ink)" : "transparent"}` }} />
              ))}
            </div>
            <label className="duo-label" htmlFor="np-text">Your note</label>
            <textarea id="np-text" className="duo-textarea" maxLength={2000} required value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "quote" ? "Something worth remembering" : "An idea or some feedback for the team"} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label className="duo-btn duo-btn-g" style={{ minHeight: 44 }}>
                <Camera size={18} aria-hidden="true" />{image ? "Change photo" : "Add photo"}
                <input type="file" accept="image/*" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </label>
              {image && <Button variant="text" onClick={() => setImage(null)}>Remove photo</Button>}
              <Button variant="ghost" aria-pressed={anonymous} style={{ minHeight: 44 }} onClick={() => setAnonymous((a) => !a)}>{anonymous ? "Posting anonymously" : "Post with my name"}</Button>
            </div>
            {image && <img src={image} alt="Photo to post" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 14 }} />}
          </>
        )}

        {kind === "kudos" && (
          <>
            <label className="duo-label" htmlFor="np-to">Who's it for?</label>
            <select id="np-to" className="duo-input" required value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choose a colleague</option>
              {people.map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}
            </select>
            <label className="duo-label" htmlFor="np-kudos">What did they do?</label>
            <textarea id="np-kudos" className="duo-textarea" maxLength={500} required value={text} onChange={(e) => setText(e.target.value)} />
            <span className="duo-sub" style={{ fontSize: 12 }}>Kudos always shows your name. There are no points or rewards.</span>
          </>
        )}

        {kind === "poll" && (
          <>
            <label className="duo-label" htmlFor="np-q">Question</label>
            <input id="np-q" className="duo-input" maxLength={140} required value={title} onChange={(e) => setTitle(e.target.value)} />
            {options.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="duo-label" htmlFor={`np-o${i}`}>Option {i + 1}</label>
                  <input id={`np-o${i}`} className="duo-input" maxLength={60} required={i < 2} value={o} onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value : x)))} />
                </div>
                {options.length > 2 && <button type="button" aria-label={`Remove option ${i + 1}`} className="duo-btn duo-btn-g duo-btn-icon" style={{ width: 50, minHeight: 50 }} onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>}
              </div>
            ))}
            {options.length < 6 && <Button variant="ghost" style={{ alignSelf: "flex-start", minHeight: 44 }} onClick={() => setOptions((all) => [...all, ""])}><Plus size={16} aria-hidden="true" />Add an option</Button>}
            <span className="duo-label">Closes</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[[0, "Today"], [3, "In 3 days"], [7, "In a week"]].map(([n, l]) => <button key={n} type="button" className="duo-chip" aria-pressed={closes === n} onClick={() => setCloses(n as number)}>{l}</button>)}
            </div>
            <span className="duo-sub" style={{ fontSize: 12 }}>Anyone can start a poll. People see the totals, never who picked what.</span>
          </>
        )}

        <Button type="submit" style={{ width: "100%" }} disabled={post.isPending}>{kind === "kudos" ? "Post kudos" : kind === "poll" ? "Post poll" : "Post to feed"}</Button>
      </form>
    </Sheet>
  );
}

function ComingUp({ posts }: { posts: FeedPost[] }) {
  const events = posts.filter((p): p is Extract<FeedPost, { type: "event" }> => p.type === "event" && !p.cancelled && Date.parse(p.startsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 4);
  if (!events.length) return null;
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
      <span className="duo-h2" style={{ fontSize: 18 }}>Coming up</span>
      {events.map((e) => (
        <Link key={e.id} href={`/feed/events/${e.id}`} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
          <CalendarDays size={18} aria-hidden="true" style={{ color: "var(--duo-grape-text)", flexShrink: 0 }} />
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{e.title}</span>
            <span className="duo-sub" style={{ fontSize: 12 }}>{fmt(e.startsAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {e.going} going</span>
          </span>
          {e.mine && <Pill tone="green">Going</Pill>}
        </Link>
      ))}
    </Card>
  );
}

export function FeedPage() {
  const params = useSearchParams();
  const router = useRouter();
  const feed = useFeed();
  const raw = params.get("filter") as Filter | null;
  const filter: Filter = FILTERS.some(([f]) => f === raw) ? (raw as Filter) : "all";
  const [compose, setCompose] = useState<Compose | null>(null);

  // "Brag on the feed" and other links can open the composer: /feed?new=quote&text=…
  useEffect(() => {
    const kind = params.get("new");
    if (kind === "quote" || kind === "feedback" || kind === "kudos" || kind === "poll") {
      setCompose({ kind, text: params.get("text") ?? undefined, to: params.get("to") ?? undefined });
      router.replace(filter === "all" ? "/feed" : `/feed?filter=${filter}`, { scroll: false });
    }
  }, [params, router, filter]);

  const data = feed.data;
  const posts = data?.posts ?? [];
  const celebrations = data?.celebrations ?? [];
  const count = (f: Filter) => (f === "celebration" ? celebrations.length : f === "all" ? posts.length + celebrations.length : posts.filter((p) => matches(p, f)).length);
  const shown = posts.filter((p) => matches(p, filter));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const canModerate = !!data?.canModerate;

  const card = (p: FeedPost) => {
    if (p.type === "announcement") return <AnnouncementCard key={p.id} post={p} />;
    if (p.type === "event") return <EventCard key={p.id} post={p} />;
    if (p.type === "poll") return <PollCard key={p.id} post={p} canModerate={canModerate} />;
    if (p.type === "kudos") return <KudosCard key={p.id} post={p} canModerate={canModerate} />;
    return <NoteCard key={p.id} post={p} canModerate={canModerate} />;
  };
  const wish = (c: Feed["celebrations"][number]) => setCompose({ kind: "kudos", to: c.email, text: c.type === "birthday" ? `Happy birthday, ${c.name}! 🎂` : `Happy work anniversary, ${c.name}!` });

  return (
    <>
      <div className="duo-col duo-with-rail duo-screen-in">
        <PageHeader title="Feed" subtitle={data ? `${posts.filter((p) => Date.parse(p.at) > weekAgo).length} posts this week` : "Loading…"} actions={<><Button onClick={() => setCompose({ kind: "quote" })}><Plus size={18} aria-hidden="true" />New post</Button><BellLink /></>} />
        <nav aria-label="Filter the feed" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FILTERS.map(([f, label]) => (
            <Link key={f} href={f === "all" ? "/feed" : `/feed?filter=${f}`} replace scroll={false} className="duo-chip" aria-current={filter === f ? "true" : undefined}>{label}<span className="duo-chip-count">{data ? count(f) : "·"}</span></Link>
          ))}
        </nav>
        {feed.isPending ? (
          <div aria-busy="true" aria-label="Loading the feed" style={{ display: "flex", flexDirection: "column", gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="duo-flat" style={{ height: 120 }} />)}</div>
        ) : feed.isError ? (
          <Card role="alert" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
            <span className="duo-h2">Couldn't load the feed</span><span className="duo-sub">{feed.error.message}</span><Button onClick={() => feed.refetch()}>Try again</Button>
          </Card>
        ) : (
          <>
            {(filter === "all" || filter === "celebration") && celebrations.map((c) => <CelebrationCard key={c.id} c={c} onWish={() => wish(c)} />)}
            {shown.map(card)}
            {shown.length === 0 && (filter !== "celebration" || celebrations.length === 0) && !(filter === "all" && celebrations.length) && (
              <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px", textAlign: "center" }}>
                <Lappy pose="idle" width={120} decorative />
                <span className="duo-h2">Nothing here yet</span>
                <span className="duo-sub">Be the first to post. Lappy promises to react.</span>
                <Button onClick={() => setCompose({ kind: filter === "poll" ? "poll" : filter === "kudos" ? "kudos" : filter === "feedback" ? "feedback" : "quote" })}><Plus size={18} aria-hidden="true" />New post</Button>
              </Card>
            )}
          </>
        )}
        {data && <div className="duo-rail-hide" style={{ display: "contents" }}><ComingUp posts={posts} /></div>}
      </div>
      {data && (
        <aside className="duo-rail" aria-label="Coming up" style={{ paddingTop: 66 }}>
          <ComingUp posts={posts} />
          <Flat style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><BarChart3 size={18} aria-hidden="true" />Post anything</span>
            <span className="duo-sub" style={{ fontSize: 13 }}>Quotes, feedback, a photo, kudos for a colleague, or a quick poll. Reactions are just for fun.</span>
          </Flat>
        </aside>
      )}
      {compose && data && <NewPostSheet key={JSON.stringify(compose)} start={compose} people={data.people} onClose={() => setCompose(null)} />}
    </>
  );
}
