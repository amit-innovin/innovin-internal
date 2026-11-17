"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronRight, Footprints, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, IconCircle, QueryState, StatusChip } from "@/components/m3";
import { TeaLappy } from "@/components/m3/art";
import { TeaActions, teaCopy } from "@/components/snacks/tea";
import { PageHero } from "@/components/m3/hero";
import { CheckIn, timeIST } from "@/components/home/check-in";
import type { DaysView } from "@/lib/days";
import { paceVerdict, plannedCount, timeOfDayIST, weekStrip, type WeekDay } from "@/lib/pace";
import { useDays, useFeed, useMarkDay, useNotifications, useSend, useTea, useWorkspace, type FeedPost, type Tea } from "@/lib/queries";

const IST = "Asia/Kolkata";
const longDate = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const at = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...o }).format(new Date(iso));
const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };

function TimeCell({ top, bottom }: { top: string; bottom: string }) {
  return <span style={{ flex: "none", width: 60 }}><span style={{ display: "block", fontSize: 15, fontWeight: 700, lineHeight: "20px" }}>{top}</span><span className="m3-small">{bottom}</span></span>;
}

function Header({ firstName, days }: { firstName: string; days: DaysView | undefined }) {
  const time = timeOfDayIST(new Date());
  const unread = useNotifications().data?.unread ?? 0;
  const mark = useMarkDay();
  const me = days?.me;
  return (
    <PageHero page="home" time={time}
      title={`Good ${time}, ${firstName}`}
      subtitle={days ? longDate(days.today) : " "}
      actions={<>
        <Link href="/wifi?check=1" className="m3-hero-btn" aria-label="Check office Wi-Fi"><Wifi size={22} aria-hidden="true" /></Link>
        <Link href="/notifications" className="m3-hero-btn" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell size={22} aria-hidden="true" />
          {unread > 0 && <span className="m3-dot-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
        </Link>
        <Link href="/account" aria-label="Account"><Avatar name={firstName} size={40} /></Link>
      </>}>
      {me && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 8, flexWrap: "nowrap" }}>
          <span className="m3-chip m3-chip-success m3-chip-enter">In office · {timeIST(me.at)}</span>
          <Button variant="text" style={{ height: 32, padding: "0 8px", fontSize: 13, color: time === "evening" ? "#FFFFFF" : undefined }} aria-label="Change today's status" disabled={mark.isPending}
            onClick={() => mark.mutate({ mode: "none" }, { onError: (e) => toast.error(e.message) })}>Change</Button>
        </div>
      )}
    </PageHero>
  );
}

// Home's tea row: the same round and answer as the Snacks tab's tea card.
function TeaRow({ tea }: { tea: Tea }) {
  const copy = teaCopy(tea);
  if (!copy) return null;
  return (
    <div className="m3-row" style={{ alignItems: "flex-start" }}>
      <TimeCell top={copy.at} bottom="Today" />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span>
            <span style={{ display: "block", fontWeight: 600 }}>{copy.round.open && tea.mine === null ? "Tea round" : copy.title}</span>
            <span className="m3-small">{copy.line}</span>
          </span>
          {copy.lappy && <TeaLappy />}
        </span>
        <TeaActions tea={tea} compact />
      </span>
    </div>
  );
}

function UpNext({ days }: { days: DaysView }) {
  const tea = useTea().data;
  const feed = useFeed().data;
  const rsvp = useSend<{ eventId: string; going: boolean }>(["feed"], "/api/events", "PATCH");
  const now = Date.now();
  const event = feed?.posts
    .filter((p): p is Extract<FeedPost, { type: "event" }> => p.type === "event" && !p.cancelled && Date.parse(p.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const poll = feed?.posts.find((p): p is Extract<FeedPost, { type: "poll" }> => p.type === "poll" && !p.closed && !p.options.some((o) => o.mine));
  const showTea = days.me?.mode === "office" && !!tea;
  if (!showTea && !event && !poll) return null;
  return (
    <section aria-label="Up next" className="m3-card" style={{ padding: "6px 0" }}>
      <h2 className="m3-title" style={{ padding: "12px 16px 4px" }}>Up next</h2>
      {showTea && <TeaRow tea={tea} />}
      {event && (
        <div className="m3-row">
          <TimeCell top={at(event.startsAt, { weekday: "short" })} bottom={at(event.startsAt, { hour: "numeric", minute: "2-digit" })} />
          <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontWeight: 600 }}>{event.title}</span><span className="m3-small">{event.going} going{event.location ? ` · ${event.location}` : ""}</span></span>
          <Button variant={event.mine ? "tonal" : "outlined"} aria-pressed={event.mine} style={{ height: 36, padding: "0 14px", flex: "none" }} disabled={rsvp.isPending}
            onClick={() => rsvp.mutate({ eventId: event.id, going: !event.mine }, { onError: (e) => toast.error(e.message) })}>{event.mine ? "Going" : "I'm in"}</Button>
        </div>
      )}
      {poll && (
        <Link href="/feed" className="m3-row">
          <TimeCell top={poll.closesAt ? at(poll.closesAt, { weekday: "short" }) : "Open"} bottom={poll.closesAt ? "closes" : "poll"} />
          <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontWeight: 600 }}>Poll: {poll.question}</span><span className="m3-small">Waiting for your vote</span></span>
          <ChevronRight size={20} color="var(--m3-on-surface-variant)" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

const DAY_STYLE: Record<WeekDay["state"], { background: string; color: string; border: string }> = {
  done: { background: "var(--m3-primary)", color: "#FFFFFF", border: "0" },
  planned: { background: "transparent", color: "var(--m3-primary)", border: "1.5px solid var(--m3-primary)" },
  leave: { background: "var(--m3-tertiary-container)", color: "var(--m3-on-tertiary-container)", border: "0" },
  off: { background: "transparent", color: "var(--m3-outline)", border: "1px solid transparent" },
  empty: { background: "transparent", color: "var(--m3-outline)", border: "1px dashed var(--m3-outline-variant)" },
};

function ThisWeek({ days }: { days: DaysView }) {
  const pace = paceVerdict({ done: days.summary.done, planned: plannedCount(days), target: days.summary.target, month: days.month });
  return (
    <section aria-label="This week" className="m3-card m3-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><h2 className="m3-title">This week</h2><StatusChip tone={pace.tone}>{pace.short}</StatusChip></span>
        <Link href="/days" className="m3-btn m3-btn-text" style={{ height: 36, padding: "0 8px" }}>Plan days</Link>
      </div>
      <div role="img" aria-label={pace.long} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6, textAlign: "center" }}>
        {weekStrip(days).map((d) => (
          <span key={d.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: d.today ? 700 : 500, color: "var(--m3-on-surface-variant)" }}>{d.label}</span>
            <span style={{ width: 40, height: 40, borderRadius: 20, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 600, ...DAY_STYLE[d.state], outline: d.today ? "2px solid var(--m3-on-surface)" : "none", outlineOffset: 2 }}>{d.day}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function Crowd({ days }: { days: DaysView }) {
  const { inToday } = days.around;
  if (!inToday.names.length) return null;
  return (
    <section aria-label="In office today" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 className="m3-title" style={{ padding: "0 4px" }}>In office today</h2>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -18px", padding: "0 18px" }}>
        {inToday.names.map((n, i) => (
          <div key={`${n}-${i}`} className="m3-card" style={{ flex: "none", width: 112, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
            <Avatar name={n} size={52} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{n}</span>
            <span className="m3-small" style={{ fontSize: 12 }}>In today</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepsTile() {
  const steps = useWorkspace().data?.steps.me;
  const today = steps?.today?.steps ?? 0;
  const pct = Math.min(100, today / 100);
  return (
    <Link href="/steps" className="m3-card" style={{ display: "flex", alignItems: "center", gap: 14, color: "inherit", textDecoration: "none" }} aria-label={`10K steps: ${today.toLocaleString("en-IN")} today`}>
      <IconCircle tone="success"><Footprints size={20} /></IconCircle>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 20, lineHeight: "26px", fontWeight: 600 }}>{today.toLocaleString("en-IN")}</span>
        <span className="m3-small">steps today{steps?.rank ? ` · #${steps.rank} on the board` : ""}</span>
      </span>
      <svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="#EEF0F3" strokeWidth="5" /><circle cx="22" cy="22" r="18" fill="none" stroke="var(--m3-primary)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pct * 1.131).toFixed(1)} 113.1`} transform="rotate(-90 22 22)" /></svg>
    </Link>
  );
}

// Home from the Material 3 prototype: what needs you today, in time order. Tea and other
// office-only items show once you've checked in; there is no remote mark.
export function HomePage({ firstName }: { firstName: string }) {
  const days = useDays();
  return (
    <div className="m3 m3-page m3-home m3-stack">
      <Header firstName={firstName} days={days.data} />
      {days.isPending || days.isError ? (
        <QueryState error={days.error} onRetry={() => days.refetch()} what="your day" />
      ) : (
        <>
          <CheckIn days={days.data} />
          <UpNext days={days.data} />
          <ThisWeek days={days.data} />
          <Crowd days={days.data} />
          <StepsTile />
        </>
      )}
    </div>
  );
}
