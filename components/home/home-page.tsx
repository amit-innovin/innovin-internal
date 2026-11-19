"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, ChevronRight, CircleHelp, Cookie, Footprints, LoaderCircle, MapPin, Palmtree, ShieldCheck, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, QueryState } from "@/components/m3";
import { SpeakUpIcon } from "@/components/m3/icons";
import { AccountButton, NotificationsBell } from "@/components/m3/app-shell";
import { PostCard } from "@/components/feed/post-card";
import { clock, TeaActions, teaCopy } from "@/components/snacks/tea";
import { timeIST, useCheckIn } from "@/components/home/check-in";
import { SayHiSheet, useSayHiSetting } from "@/components/home/say-hi";
import type { DaysView } from "@/lib/days";
import { paceVerdict, plannedCount, timeOfDayIST, weekStrip, type WeekDay } from "@/lib/pace";
import { teaToShow } from "@/lib/snacks-rules";
import { useAdminOverview, useDays, useFeed, useLeaveBalances, useMarkDay, usePlanDay, useRsvp, useSnacks, useSnackWrite, useSteps, useTea, type FeedPost, type Snacks, type Tea } from "@/lib/queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readError, send } from "@/lib/fetcher";

// Today (design: https://claude.ai/artifact/1cR9t8dgrFiqAPsFeV1kPo). Apple Health's Summary
// structure in Material 3: a large title, the Your day ribbon, then sections with bold headers.
// Everything acts in place; a section's header or a card's label opens the full page.

const IST = "Asia/Kolkata";
const longDate = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const at = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...o }).format(new Date(iso));
const istDate = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);
const istHours = (iso: string) => { const d = new Date(Date.parse(iso) + 5.5 * 3600_000); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const hhmmHours = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h + m / 60; };
const fmt = (n: number) => n.toLocaleString("en-IN");
const Chevron = () => <ChevronRight size={16} aria-hidden="true" />;

function Section({ title, label, end, children, tone }: { title: ReactNode; label: string; end?: ReactNode; children: ReactNode; tone?: string }) {
  return (
    <section aria-label={label} className="td-sec">
      <div className="td-sech"><h2 style={tone ? { color: tone } : undefined}>{title}</h2>{end}</div>
      {children}
    </section>
  );
}

// ---- Large title + check-in ----

function Title({ firstName, name, days, check }: { firstName: string; name: string; days: DaysView; check: ReturnType<typeof useCheckIn> }) {
  const mark = useMarkDay();
  const me = days.me;
  const showButton = !me && check.step !== "success";
  return (
    <>
      <header className="td-title">
        <div className="td-title-text">
          <span className="td-eyebrow">{longDate(days.today)}</span>
          <h1 className="td-h1">Good {timeOfDayIST(new Date())}, {firstName}</h1>
        </div>
        {showButton && (
          <div className="td-checkin-lg">
            <span className="m3-small" style={{ textAlign: "right" }}>{days.isOfficeDayToday ? "One of your office days." : "In the office after all?"}<br />Location is checked once, when you tap.</span>
            <Button className="m3-btn-lg" disabled={check.busy || check.step === "closed"} onClick={check.checkIn} style={{ height: 56, borderRadius: 16, padding: "0 24px" }}>
              {check.busy ? <LoaderCircle size={20} className="m3-spin" aria-hidden="true" /> : <MapPin size={20} aria-hidden="true" />}{check.problem ? "Try again" : "Check in"}
            </Button>
          </div>
        )}
        <div className="td-title-end td-phone-only">
          <NotificationsBell />
          <AccountButton name={name} />
        </div>
      </header>
      {me && (
        <div className="td-status">
          <span className="m3-chip m3-chip-success m3-chip-enter">In office · {timeIST(me.at)}</span>
          <Button variant="text" style={{ height: 36, padding: "0 10px" }} aria-label="Change today's status" disabled={mark.isPending}
            onClick={() => mark.mutate({ mode: "none" }, { onError: (e) => toast.error(e.message) })}>Change</Button>
        </div>
      )}
      {check.step === "checking" && <div role="status" className="td-status m3-small"><LoaderCircle size={18} className="m3-spin" aria-hidden="true" />Checking your location…</div>}
      {check.step === "success" && !me && <div role="status" className="td-status"><span className="m3-chip m3-chip-success">You&apos;re in</span></div>}
      {check.problem && (
        <div role="alert" className="td-card" style={{ background: "var(--m3-warn-container)", color: "var(--m3-on-warn-container)", gap: 4 }}>
          <b>{check.problem.title}</b>
          <span className="m3-body">{check.problem.body}</span>
        </div>
      )}
    </>
  );
}

// ---- Your day: 9 am to 7 pm with today's deadlines on it ----

type Pin = { key: string; hours: number; label: string; done: boolean; tone: [string, string] };
const START = 9, END = 19;
const pos = (h: number) => `${Math.min(98, Math.max(2, ((h - START) / (END - START)) * 100)).toFixed(1)}%`;

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return now;
}

function YourDay({ days, tea, snacks, posts }: { days: DaysView; tea?: Tea; snacks?: Snacks; posts: FeedPost[] }) {
  const now = useNow();
  const inOffice = days.me?.mode === "office";
  const pins: Pin[] = [];
  const open: [string, string] = ["#FFF3CC", "#5C4300"], green: [string, string] = ["#CDEBD6", "#0B3D1F"], muted: [string, string] = ["#EBEEF4", "#41474D"];
  if (days.me) pins.push({ key: "in", hours: istHours(days.me.at), label: `Checked in ${timeIST(days.me.at)}`, done: true, tone: green });
  if (snacks && (snacks.today.open || snacks.today.ordered)) {
    const mine = snacks.shelf.find((s) => s.id === snacks.today.mine)?.name;
    pins.push({ key: "snack", hours: hhmmHours(snacks.today.orderAt), label: mine ? `Snack: ${mine}` : `Snack order ${clock(snacks.today.orderAt)}`, done: !!mine || !snacks.today.open, tone: mine ? green : inOffice && snacks.today.open ? open : muted });
  }
  if (tea?.round) {
    const answered = tea.mine !== null;
    pins.push({ key: "tea", hours: hhmmHours(tea.round.at), label: tea.mine === true ? "Tea · you're in" : tea.mine === false ? "Tea · skipped" : `Tea ${clock(tea.round.at)}`, done: answered || !tea.round.open, tone: answered ? green : inOffice && tea.round.open ? open : muted });
  }
  for (const p of posts) {
    if (p.type === "poll" && !p.closed && p.closesAt && istDate(p.closesAt) === days.today) {
      const voted = p.options.some((o) => o.mine);
      pins.push({ key: p.id, hours: istHours(p.closesAt), label: voted ? "Poll · voted" : `Poll closes ${at(p.closesAt, { hour: "numeric", minute: "2-digit" })}`, done: voted, tone: voted ? green : ["#EBDCFF", "#20142F"] });
    }
    if (p.type === "event" && !p.cancelled && istDate(p.startsAt) === days.today) {
      pins.push({ key: p.id, hours: istHours(p.startsAt), label: `${p.title} ${at(p.startsAt, { hour: "numeric", minute: "2-digit" })}`, done: p.mine, tone: p.mine ? green : ["#D3E5F5", "#0C1D29"] });
    }
  }
  pins.sort((a, b) => a.hours - b.hours);
  const left = pins.filter((p) => !p.done && p.key !== "in").length;
  const nowH = now === null ? null : istHours(new Date(now).toISOString());
  const note = !inOffice && pins.some((p) => p.key === "tea" || p.key === "snack") ? "Check in to join tea and pick a snack"
    : pins.length === 0 ? "Nothing scheduled today" : left === 0 ? "All done for today" : `${left} thing${left === 1 ? "" : "s"} left today`;
  return (
    <section aria-label="Your day" className="td-card" style={{ gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 14 }}>Your day{nowH !== null && <span className="m3-small" style={{ fontWeight: 600 }}> · now {at(new Date(now!).toISOString(), { hour: "numeric", minute: "2-digit" })}</span>}</b>
        <span className="m3-small">{note}</span>
      </div>
      <div className="td-ribbon">
        <div className="td-track" />
        {nowH !== null && <div className="td-past" style={{ width: pos(nowH) }} />}
        {[[9, "9 am"], [11, "11"], [13, "1 pm"], [15, "3"], [17, "5"], [19, "7 pm"]].map(([h, l]) => (
          <span key={h} className={`td-hour${h === 11 || h === 15 || h === 17 ? " td-hour-mid" : ""}`} style={{ left: pos(h as number) }}>{l}</span>
        ))}
        {pins.map((p, i) => <span key={p.key} className="td-pin-label" style={{ left: pos(p.hours), top: i % 2 ? 58 : 0, background: p.tone[0], color: p.tone[1] }}>{p.label}</span>)}
        {pins.map((p) => <span key={`d-${p.key}`} className="td-pin-dot" aria-hidden="true" style={{ left: pos(p.hours), ...(p.done ? { background: "var(--m3-success)" } : { background: "#FFFFFF", border: "3px solid var(--m3-primary)" }) }} />)}
        {nowH !== null && nowH >= START && nowH <= END && (
          <>
            <span className="td-now-line" aria-hidden="true" style={{ left: pos(nowH) }} />
            <span className="td-now" style={{ left: pos(nowH) }}>NOW {at(new Date(now!).toISOString(), { hour: "numeric", minute: "2-digit" })}</span>
          </>
        )}
      </div>
    </section>
  );
}

// ---- Needs you (admins) ----

function NeedsYou({ snacks }: { snacks?: Snacks }) {
  const overview = useAdminOverview();
  const order = useSnackWrite<{ action: "order-placed" | "order-undo" }>("PATCH");
  const items = overview.data?.needsYou ?? [];
  const showOrder = !!snacks?.canManage && (snacks.today.open || (snacks.today.ordered && snacks.today.canUndo));
  if (!overview.data || (!items.length && !showOrder)) return null;
  return (
    <Section title="Needs you" label="Needs you" tone="var(--m3-tertiary)" end={<Link href="/admin" className="m3-btn m3-btn-text">Admin tools</Link>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {showOrder && snacks && (
          <div className="td-card" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <span className="m3-icon m3-tone-success"><Cookie size={20} aria-hidden="true" /></span>
            <span className="td-grow"><b>{snacks.today.ordered ? "Snacks marked ordered" : `Snack order at ${clock(snacks.today.orderAt)}`}</b><span className="m3-small">{snacks.today.ordered ? "You can undo this for a while" : "Picks are on the Office page"}</span></span>
            {snacks.today.ordered
              ? <Button variant="text" disabled={order.isPending} onClick={() => order.mutate({ action: "order-undo" }, { onError: (e) => toast.error(e.message) })}>Undo</Button>
              : <Button disabled={order.isPending} onClick={() => order.mutate({ action: "order-placed" }, { onError: (e) => toast.error(e.message) })}>Mark ordered</Button>}
          </div>
        )}
        {items.slice(0, showOrder ? 5 : 6).map((n) => (
          <Link key={n.id} href={n.href} className="td-card" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <span className={`m3-icon ${n.urgent ? "m3-tone-warn" : "m3-tone-tertiary"}`}><ShieldCheck size={20} aria-hidden="true" /></span>
            <span className="td-grow"><b>{n.title}</b>{n.sub && <span className="m3-small">{n.sub}</span>}</span>
            <Chevron />
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ---- Pinned: Apple Health-style summary cards ----

function PinHead({ href, color, icon, label, when }: { href: string; color: string; icon: ReactNode; label: string; when: string }) {
  return <Link href={href} className="td-pinhd" style={{ color }}>{icon}{label}<span className="td-pinwhen">{when}<Chevron /></span></Link>;
}

const DOT: Record<WeekDay["state"], React.CSSProperties> = {
  done: { background: "var(--m3-tertiary)", color: "#FFFFFF", border: 0 },
  planned: { color: "var(--m3-tertiary)", border: "2px solid var(--m3-tertiary)" },
  leave: { background: "var(--m3-tertiary-container)", color: "var(--m3-on-tertiary-container)", border: 0 },
  off: { color: "var(--m3-outline)", border: "1px solid transparent" },
  empty: { color: "var(--m3-outline)", border: "1.5px dashed var(--m3-outline-variant)" },
};

function OfficeDaysPin({ days }: { days: DaysView }) {
  const plan = usePlanDay();
  const pace = paceVerdict({ done: days.summary.done, planned: plannedCount(days), target: days.summary.target, month: days.month });
  const [head, tail] = pace.short.split(" · ");
  const big = pace.state === "short" ? head.replace(/^Plan /, "").replace(/ more$/, "") : head;
  const unit = pace.state === "short" ? "more to plan this month" : pace.state === "track" ? (tail ? `${tail} ${tail.startsWith("1 ") ? "day" : "days"}` : "this month") : "";
  return (
    <div className="td-pin td-wide">
      <PinHead href="/days" color="var(--m3-tertiary)" icon={<CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" />} label="Office days" when="This week" />
      <span><span className="td-big">{big}</span> <span className="td-unit">{unit}</span></span>
      <div className="td-week" role="group" aria-label={pace.long}>
        {weekStrip(days).map((d) => {
          const row = days.days.find((x) => x.date === d.date);
          const canPlan = !!row && d.date > days.today && row.working && !row.leave;
          const style = { ...DOT[d.state], ...(d.today ? { outline: "2px solid var(--m3-on-surface)", outlineOffset: 2 } : {}) };
          return (
            <span key={d.date} className="td-day" style={{ fontWeight: d.today ? 800 : 500 }}>
              {canPlan
                ? <button type="button" className="td-dot" style={style} aria-pressed={!!row?.planned} aria-label={`${d.label} ${d.day}: ${row?.planned ? "planned, tap to unplan" : "tap to plan"}`} disabled={plan.isPending}
                  onClick={() => plan.mutate({ date: d.date, planned: !row?.planned }, { onError: (e) => toast.error(e.message) })}>{d.day}</button>
                : <span className="td-dot" style={style} aria-label={`${d.label} ${d.day}: ${d.state}`}>{d.day}</span>}
              {d.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function useAddSteps() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (add: number) => {
      const res = await send("/api/steps", { method: "POST", json: { add } });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["steps"] }),
  });
}

function StepsPin() {
  const steps = useSteps().data?.me;
  const add = useAddSteps();
  const [value, setValue] = useState("");
  const today = steps?.today?.steps ?? 0;
  const pct = Math.min(1, today / 10_000);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value.replace(/\D/g, ""));
    if (!n) return;
    add.mutate(n, { onSuccess: () => setValue(""), onError: (err) => toast.error(err.message) });
  };
  return (
    <div className="td-pin td-wide">
      <PinHead href="/steps" color="var(--m3-success)" icon={<Footprints size={16} strokeWidth={2.2} aria-hidden="true" />} label="10K steps" when="Today" />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
          <span><span className="td-big">{fmt(today)}</span> <span className="td-unit">steps</span></span>
          <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
            <label className="sr-only" htmlFor="td-steps">Add steps from your phone&apos;s counter</label>
            <input id="td-steps" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add steps"
              style={{ width: 0, flex: "1 1 72px", maxWidth: 110, height: 34, borderRadius: 10, border: "1px solid var(--m3-outline)", padding: "0 10px", font: "inherit", fontSize: 14, background: "var(--m3-surface)" }} />
            <Button type="submit" variant="tonal" disabled={!value || add.isPending} style={{ height: 34, padding: "0 12px", fontSize: 13, background: "var(--m3-success-container)", color: "var(--m3-on-success-container)" }}>Add</Button>
          </form>
        </span>
        <svg role="img" aria-label={`${fmt(today)} of 10,000 steps`} width="60" height="60" viewBox="0 0 44 44" style={{ flex: "none" }}>
          <circle cx="22" cy="22" r="17" fill="none" stroke="#DDF1E4" strokeWidth="7" />
          <circle cx="22" cy="22" r="17" fill="none" stroke="var(--m3-success)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(pct * 106.8).toFixed(1)} 106.8`} transform="rotate(-90 22 22)" />
        </svg>
      </div>
    </div>
  );
}

const LEAVE_NAME = { cl: "Casual", sl: "Sick", el: "Earned", fl: "Flexible" } as const;
function LeavePin() {
  const leave = useLeaveBalances().data;
  const ledger = leave?.ledger ?? [];
  const cl = ledger.find((l) => l.type === "cl");
  const rest = ledger.filter((l) => l.type !== "cl");
  const asOf = leave?.asOf ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: IST }).format(new Date(leave.asOf)) : null;
  return (
    <div className="td-pin">
      <PinHead href="/days?tab=leave" color="#8A4A00" icon={<Palmtree size={16} strokeWidth={2.2} aria-hidden="true" />} label="Leave" when={leave?.source === "zoho-snapshot" && asOf ? `Zoho · ${asOf}` : "Days"} />
      {cl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span><span className="td-big">{fmt(cl.remaining)}</span> <span className="td-unit">casual days left</span></span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{rest.map((l) => <span key={l.type} className="td-tag">{LEAVE_NAME[l.type]} {fmt(l.remaining)}</span>)}</span>
        </div>
      ) : <span className="m3-small">{leave && !leave.signedIn ? "Sign in with Google to see your balances." : "Balances show here once Zoho has them."}</span>}
      {leave?.applyUrl && <a href={leave.applyUrl} target="_blank" rel="noreferrer" className="m3-btn m3-btn-text" style={{ alignSelf: "flex-start", height: 32, padding: "0 6px", fontSize: 13 }}>Apply in Zoho</a>}
    </div>
  );
}

function WifiPin() {
  return (
    <div className="td-pin">
      <PinHead href="/wifi" color="var(--m3-primary)" icon={<Wifi size={16} strokeWidth={2.2} aria-hidden="true" />} label="Office Wi-Fi" when="Check" />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="m3-small">Slow? An 8-second test tells the admins where and how slow.</span>
          <Link href="/wifi?check=1" className="m3-btn m3-btn-tonal" style={{ alignSelf: "flex-start", height: 34, padding: "0 14px", fontSize: 13 }}>Check now</Link>
        </span>
        <svg aria-hidden="true" width="56" height="48" viewBox="0 0 64 56" style={{ flex: "none" }}><rect x="2" y="40" width="10" height="14" rx="3" fill="#9CCBEA" /><rect x="18" y="30" width="10" height="24" rx="3" fill="#9CCBEA" /><rect x="34" y="18" width="10" height="36" rx="3" fill="#DDE7F0" /><rect x="50" y="4" width="10" height="50" rx="3" fill="#DDE7F0" /></svg>
      </div>
    </div>
  );
}

// ---- Up next ----

function UpNext({ days, tea, posts }: { days: DaysView; tea?: Tea; posts: FeedPost[] }) {
  const rsvp = useRsvp();
  const now = Date.now();
  const showTea = teaToShow(tea, days.me?.mode === "office") && tea && teaCopy(tea);
  const polls = posts.filter((p): p is Extract<FeedPost, { type: "poll" }> => p.type === "poll" && !p.closed && !p.options.some((o) => o.mine)).slice(0, 2);
  const events = posts.filter((p): p is Extract<FeedPost, { type: "event" }> => p.type === "event" && !p.cancelled && Date.parse(p.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 2);
  const copy = showTea && tea ? teaCopy(tea) : null;
  return (
    <Section title="Up next" label="Up next" end={<Link href="/feed" className="m3-btn m3-btn-text">Feed</Link>}>
      <div className="td-card td-list">
        {copy && tea && (
          <div className="td-row" style={{ alignItems: "flex-start" }}>
            <span className="td-when"><b>{copy.at}</b><span className="m3-small">Today</span></span>
            <span className="td-grow" style={{ gap: 8 }}>
              <span style={{ display: "flex", flexDirection: "column" }}><b>{copy.round.open && tea.mine === null ? "Tea round" : copy.title}</b><span className="m3-small">{copy.line}</span></span>
              <TeaActions tea={tea} compact />
            </span>
          </div>
        )}
        {polls.map((p) => (
          <Link key={p.id} href="/feed" className="td-row">
            <span className="td-when"><b>{p.closesAt ? at(p.closesAt, { weekday: "short" }) : "Open"}</b><span className="m3-small">{p.closesAt ? `closes ${at(p.closesAt, { hour: "numeric", minute: "2-digit" })}` : "poll"}</span></span>
            <span className="td-grow"><b>Poll: {p.question}</b><span className="m3-small">Waiting for your vote</span></span>
            <Chevron />
          </Link>
        ))}
        {events.map((e) => (
          <div key={e.id} className="td-row">
            <span className="td-when"><b>{istDate(e.startsAt) === days.today ? "Today" : at(e.startsAt, { weekday: "short", day: "numeric" })}</b><span className="m3-small">{at(e.startsAt, { hour: "numeric", minute: "2-digit" })}</span></span>
            <Link href={`/feed/events/${e.id}`} className="td-grow"><b>{e.title}</b>{e.location && <span className="m3-small">{e.location}</span>}</Link>
            <Button variant={e.mine ? "tonal" : "filled"} aria-pressed={e.mine} style={{ height: 36, padding: "0 14px", flex: "none" }} disabled={rsvp.isPending}
              onClick={() => rsvp.mutate({ eventId: e.id, going: !e.mine }, { onError: (err) => toast.error(err.message) })}>{e.mine ? "Going" : "I'm in"}</Button>
          </div>
        ))}
        {!copy && !polls.length && !events.length && (
          <div className="td-row"><span className="td-grow"><b>Nothing coming up</b><span className="m3-small">Events, polls and tea rounds show here as they come.</span></span></div>
        )}
      </div>
    </Section>
  );
}

// ---- In the office: who's in, and today's snack ----

function InTheOffice({ days, snacks }: { days: DaysView; snacks?: Snacks }) {
  const turnOn = useSayHiSetting();
  const pick = useSnackWrite<{ id: string; action: "pick" | "unpick" }>("PATCH");
  const [hiFor, setHiFor] = useState<{ email: string; name: string } | null>(null);
  const inOffice = days.me?.mode === "office";
  const { inToday } = days.around;
  const people = inToday.people.length ? inToday.people : inToday.names.map((name) => ({ email: name, name, sayHi: false }));
  const sentToday = Object.keys(days.sent).length;
  return (
    <Section title="In the office" label="In office today" end={days.sayHi ? <span className="m3-small">Say hi is on</span> : undefined}>
      <div className="td-card" style={{ gap: 16 }}>
        {people.length ? (
          <div className="td-people">
            {people.map((p) => {
              const sent = days.sent[p.email];
              const canWave = days.sayHi && inOffice && p.sayHi;
              return (
                <span key={p.email} className="td-person">
                  <Avatar name={p.name} size={52} />
                  {p.name}
                  {canWave ? (
                    <button type="button" aria-pressed={!!sent} aria-label={sent ? `${sent} to ${p.name}` : `Wave at ${p.name}`} disabled={!!sent} onClick={() => setHiFor(p)}
                      className={`m3-btn ${sent ? "m3-btn-tonal" : "m3-btn-outlined"}`} style={{ height: 30, padding: "0 10px", fontSize: 12 }}>{sent ?? "Wave"}</button>
                  ) : <span className="m3-small" style={{ fontSize: 12, fontWeight: 500 }}>In today</span>}
                </span>
              );
            })}
          </div>
        ) : <span className="m3-small">Nobody else has checked in yet.</span>}
        {!days.sayHi && (
          <span className="m3-small">Say hi is off. Turn it on to wave at people and get invites.{" "}
            <button type="button" className="m3-btn m3-btn-text" style={{ height: 30, padding: "0 4px" }} disabled={turnOn.isPending} onClick={() => turnOn.mutate(true, { onError: (e) => toast.error(e.message) })}>Turn on</button>
          </span>
        )}
        {snacks && snacks.shelf.length > 0 && (
          <>
            <div style={{ height: 1, background: "#E6E9EE" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <Link href="/snacks" style={{ fontWeight: 700, fontSize: 15, display: "inline-flex", alignItems: "center" }}>Today&apos;s snack<Chevron /></Link>
              <span className="m3-small">{snacks.today.open ? `Order goes in at ${clock(snacks.today.orderAt)}` : "Order placed"}</span>
            </div>
            <div className="td-snacks" role="group" aria-label="Pick today's snack">
              {snacks.shelf.map((s) => {
                const mine = snacks.today.mine === s.id;
                return <button key={s.id} type="button" className="td-snack" aria-pressed={mine} disabled={!inOffice || !snacks.today.open || pick.isPending}
                  onClick={() => pick.mutate({ id: s.id, action: mine ? "unpick" : "pick" }, { onError: (e) => toast.error(e.message) })}>{s.name}</button>;
              })}
            </div>
            <span className="m3-small">{!inOffice ? "Check in to pick. Nobody sees who picked what." : !snacks.today.open ? "Today's order is in." : snacks.today.mine ? `You can switch until ${clock(snacks.today.orderAt)}. Nobody sees who picked what.` : "Pick one. Nobody sees who picked what."}</span>
          </>
        )}
      </div>
      {hiFor && <SayHiSheet person={hiFor} sentToday={sentToday} onClose={() => setHiFor(null)} />}
    </Section>
  );
}

// ---- From the team ----

function FromTheTeam({ posts, newIds }: { posts: FeedPost[]; newIds: string[] }) {
  const fresh = posts.filter((p) => newIds.includes(p.id));
  const show = (fresh.length ? fresh : posts).slice(0, 3);
  if (!show.length) return null;
  return (
    <Section label="From the team" title={<>From the team{fresh.length > 0 && <span className="m3-chip" style={{ background: "var(--m3-primary-container)", color: "var(--m3-on-primary-container)" }}>{fresh.length} new</span>}</>}
      end={<Link href="/feed" className="m3-btn m3-btn-text">Open Feed</Link>}>
      <div className="td-team">
        {show.map((p) => <PostCard key={p.id} item={p} style={{ height: "100%", boxShadow: "none" }} />)}
      </div>
    </Section>
  );
}

export function HomePage({ firstName, name, isAdmin }: { firstName: string; name: string; isAdmin: boolean }) {
  const days = useDays();
  const tea = useTea().data;
  const snacks = useSnacks().data;
  const feed = useFeed().data;
  const check = useCheckIn();
  const posts = feed?.posts ?? [];
  if (days.isPending || days.isError) {
    return <div className="m3 m3-page m3-today m3-stack"><QueryState error={days.error} onRetry={() => days.refetch()} what="your day" /></div>;
  }
  const d = days.data;
  return (
    <div className="m3 m3-page m3-today m3-stack">
      <Title firstName={firstName} name={name} days={d} check={check} />
      <YourDay days={d} tea={tea} snacks={snacks} posts={posts} />
      {isAdmin && <NeedsYou snacks={snacks} />}
      <Section title="Pinned" label="Pinned">
        <div className="td-pins">
          <OfficeDaysPin days={d} />
          <StepsPin />
          <LeavePin />
          <WifiPin />
        </div>
      </Section>
      <div className="td-two">
        <UpNext days={d} tea={tea} posts={posts} />
        <InTheOffice days={d} snacks={snacks} />
      </div>
      <FromTheTeam posts={posts} newIds={feed?.newIds ?? []} />
      <div className="td-foot">
        <Link href="/grievances" className="td-speak">
          <span className="m3-icon" style={{ background: "#3A374A", color: "#FFFFFF" }}><SpeakUpIcon size={20} /></span>
          <span className="td-grow"><b style={{ fontSize: 16 }}>Speak up anonymously</b><span style={{ fontSize: 13, color: "#C9C6D6" }}>Admins see the day it was sent, never who sent it.</span></span>
          <Chevron />
        </Link>
        <Link href="/help" className="td-card" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <span className="m3-icon m3-tone-neutral"><CircleHelp size={20} aria-hidden="true" /></span>
          <span className="td-grow"><b style={{ fontSize: 16 }}>How innovin works</b><span className="m3-small">Office days, leave, tea rounds and privacy</span></span>
          <Chevron />
        </Link>
      </div>
      {!d.me && check.step !== "success" && check.step !== "closed" && (
        <Button className="td-fab" disabled={check.busy} onClick={check.checkIn}>
          {check.busy ? <LoaderCircle size={22} className="m3-spin" aria-hidden="true" /> : <MapPin size={22} aria-hidden="true" />}{check.problem ? "Try again" : "Check in"}
        </Button>
      )}
    </div>
  );
}
