"use client";
import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, Footprints, Megaphone, Wifi } from "lucide-react";
import { Avatar, Button, Card, Flat } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Lappy } from "@/components/duo/lappy";
import { CheckIn } from "@/components/home/check-in";
import { Battery } from "@/components/days/battery";
import type { DaysView } from "@/lib/days";
import { boardHref, eventHref } from "@/lib/journey";
import { useDays, useReading, useWorkspace } from "@/lib/queries";

const IST = "Asia/Kolkata";
const fmt = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...options }).format(new Date(iso));
const dayLabel = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
};

function lappyLine(days: DaysView) {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${days.today}T00:00:00Z`));
  const { done, target } = days.summary;
  if (days.me?.mode === "office") return target ? `Checked in! That's ${done} of your ${target} office days this month.` : "Checked in! Good to see you.";
  if (days.me?.mode === "remote") return "Remote today, noted.";
  return days.isOfficeDayToday ? `It's ${weekday}, one of your days. Coming in?` : `It's ${weekday}. In the office or remote today?`;
}

function Faces({ names }: { names: string[] }) {
  return <span className="duo-faces">{names.slice(0, 4).map((name, i) => <Avatar key={`${name}-${i}`} name={name} size={32} />)}</span>;
}

function Around({ days }: { days: DaysView }) {
  const { inToday, next } = days.around;
  const list = (names: string[], count: number) => (names.length ? `${names.slice(0, 3).join(", ")}${count > 3 ? " and others" : ""}` : "Nobody yet");
  return (
    <Flat aria-label="Who's around" role="group" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 200px" }}>
        <Faces names={inToday.names} />
        <span style={{ marginLeft: inToday.names.length ? 8 : 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>{inToday.count} in today</span>
          <span className="duo-sub" style={{ fontSize: 12 }}>{list(inToday.names, inToday.count)}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 200px" }}>
        <Faces names={next.names} />
        <span style={{ marginLeft: next.names.length ? 8 : 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>{next.count} expected next</span>
          <span className="duo-sub" style={{ fontSize: 12 }}>{dayLabel(next.date)} · {next.mine ? "one of your days" : "not one of your days"}</span>
        </span>
      </div>
    </Flat>
  );
}

export function HomePage({ firstName }: { firstName: string }) {
  const days = useDays();
  const workspace = useWorkspace();
  const events = (workspace.data?.events ?? []).filter((e) => !e.cancelledAt).slice(0, 3);
  const pinned = workspace.data?.announcements[0];
  const steps = workspace.data?.steps.me;
  const book = useReading().data?.current;

  const comingUp = events.length > 0 && (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
      <span className="duo-h2" style={{ fontSize: 18 }}>Coming up</span>
      {events.map((e) => (
        <Link key={e.id} href={eventHref(e.id)} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46 }}>
          <span className="duo-tone-grape" style={{ width: 42, height: 46, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "var(--duo-display)" }}>
            <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{fmt(e.startsAt, { day: "numeric" })}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{fmt(e.startsAt, { month: "short" })}</span>
          </span>
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600, lineHeight: 1.15 }}>{e.title}</span>
            <span className="duo-sub" style={{ fontSize: 12 }}>{fmt(e.startsAt, { weekday: "short", hour: "numeric", minute: "2-digit" })} · {e.going} going</span>
          </span>
        </Link>
      ))}
    </Card>
  );

  return (
    <>
      <div className="duo-col duo-with-rail duo-screen-in">
        <header style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="duo-sub">{days.data ? dayLabel(days.data.today) : " "}</span>
            <h1 className="duo-h1" style={{ fontSize: 26 }}>{greeting()}, {firstName}</h1>
          </div>
          <Link href="/wifi?check=1" className="duo-btn duo-btn-g duo-btn-icon" aria-label="Wi-Fi check"><Wifi size={22} strokeWidth={2.2} aria-hidden="true" /></Link>
          <BellLink />
        </header>

        {days.isPending ? (
          <div aria-busy="true" aria-label="Loading your day" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="duo-flat" style={{ height: 120 }} /><div className="duo-flat" style={{ height: 76 }} /><div className="duo-flat" style={{ height: 140 }} />
          </div>
        ) : days.isError ? (
          <Card role="alert" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
            <span className="duo-h2">Couldn't load your day</span>
            <span className="duo-sub">{days.error.message}</span>
            <Button onClick={() => days.refetch()}>Try again</Button>
          </Card>
        ) : (
          <>
            <div className="duo-hero">
              <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-end" }}><Lappy pose={days.data.me?.mode === "office" ? "office" : "idle"} width={days.data.me?.mode === "office" ? 150 : 128} /></div>
              <Card className="duo-bubble" aria-live="polite">{lappyLine(days.data)}</Card>
            </div>
            <CheckIn days={days.data} />

            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/steps" className="duo-btn duo-btn-g duo-tilebtn">
                <span className="duo-tag" style={{ display: "flex", alignItems: "center", gap: 6 }}><Footprints size={14} aria-hidden="true" />10K steps</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{steps?.rank ? `#${steps.rank} on the board` : "Join the board"}</span>
                <span className="duo-sub" style={{ fontSize: 12 }}>{steps?.today?.steps ? `${steps.today.steps.toLocaleString("en-IN")} today` : steps?.today?.hit ? "10K done today" : "Nothing logged today"}</span>
              </Link>
              <Link href="/reading" className="duo-btn duo-btn-g duo-tilebtn">
                <span className="duo-tag" style={{ display: "flex", alignItems: "center", gap: 6 }}><BookOpen size={14} aria-hidden="true" />Reading list</span>
                <span style={{ fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{book ? book.title : "Between books"}</span>
                <span className="duo-sub" style={{ fontSize: 12 }}>{book ? `${book.pct}% read` : "Pick one from the shelf"}</span>
              </Link>
            </div>

            {(pinned || events[0]) && (
              <section style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label="From the feed">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 className="duo-h2">From the feed</h2>
                  <Link href={boardHref()} className="duo-btn duo-btn-text">Open feed<ChevronRight size={18} aria-hidden="true" /></Link>
                </div>
                {pinned && (
                  <Link href={boardHref(pinned.id)} className="duo-btn duo-peek" style={{ background: "var(--duo-hero)", color: "#fff", boxShadow: "0 5px 0 var(--duo-ink)" }}>
                    <span className="duo-tile" style={{ background: "var(--duo-gold)", color: "var(--duo-ink)", transform: "rotate(-6deg)" }} aria-hidden="true"><Megaphone size={20} /></span>
                    <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                      <span className="duo-tag" style={{ color: "var(--duo-gold)" }}>Announcement</span>
                      <span style={{ fontSize: 17, fontWeight: 700 }}>{pinned.title}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                )}
                {events[0] && (
                  <Link href={eventHref(events[0].id)} className="duo-btn duo-btn-g duo-peek duo-rail-hide">
                    <span className="duo-tile duo-tone-grape" aria-hidden="true"><CalendarDays size={20} /></span>
                    <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                      <span className="duo-tag">Event · {fmt(events[0].startsAt, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span style={{ fontSize: 17, fontWeight: 700 }}>{events[0].title}</span>
                      <span className="duo-sub" style={{ fontSize: 12 }}>{events[0].going} going</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                )}
              </section>
            )}

            <Battery days={days.data} />
            <Around days={days.data} />
          </>
        )}
      </div>
      {comingUp && <aside className="duo-rail" aria-label="Coming up" style={{ paddingTop: 66 }}>{comingUp}</aside>}
    </>
  );
}
