"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Flat, PageHeader, Pill, Tile, type Tone } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Sheet } from "@/components/duo/sheet";
import { Battery } from "@/components/days/battery";
import type { DaysView } from "@/lib/days";
import { scheduleLabel } from "@/lib/office-days";
import { useDays, useLeaveBalances, useMarkDay, useMyLeaveRequests, useSetOfficeDays, type MyLeaveRequest } from "@/lib/queries";

type Day = DaysView["days"][number];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const fmt = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(new Date(`${date}T00:00:00Z`));
const short = (date: string) => fmt(date, { weekday: "short", day: "numeric", month: "short" });
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const MODE_LABEL = { office: "In office", remote: "Remote" } as const;

// Mon … Fri, as drawn on the Account board; Monday = 0.
const WEEKDAY_CHIPS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function dayStyle(day: Day, today: string, canFix: boolean): React.CSSProperties {
  const raised = (edge: string) => (canFix ? { boxShadow: `0 3px 0 ${edge}` } : {});
  if (day.date === today) return { border: "2.5px solid var(--duo-ink)" };
  if (day.mode === "office") return { background: "var(--duo-green)", color: "var(--duo-green-text)", border: "2.5px solid var(--duo-green-edge)", ...raised("var(--duo-green-edge)") };
  if (day.leave) return { background: "var(--duo-pink)", color: "var(--duo-pink-text)", border: "2.5px solid var(--duo-pink-edge)" };
  if (day.mode === "remote") return { background: "var(--duo-sky)", border: "2.5px solid var(--duo-sky-edge)", ...raised("var(--duo-sky-edge)") };
  if (day.planned) return { border: "2.5px dashed var(--duo-primary)" };
  if (!day.working) return { color: "var(--duo-muted)", opacity: 0.55, border: "2.5px solid transparent" };
  if (canFix) return { background: "#fff", border: "2.5px solid var(--duo-line)", boxShadow: "0 3px 0 var(--duo-line)" };
  return { border: "2.5px solid transparent" };
}

function Calendar({ view, month, onPick, onLocked }: { view: DaysView; month: string; onPick: (day: Day) => void; onLocked: (day: Day) => void }) {
  const router = useRouter();
  const go = (by: number) => router.replace(`/days?month=${shiftMonth(month, by)}`, { scroll: false });
  const offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const { done, target } = view.summary;
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Button variant="ghost" className="duo-btn-icon" style={{ width: 40, minHeight: 40 }} aria-label="Previous month" onClick={() => go(-1)}><ChevronLeft size={18} aria-hidden="true" /></Button>
        <h2 className="duo-h2" style={{ flexGrow: 1, textAlign: "center" }}>{fmt(`${month}-01`, { month: "long", year: "numeric" })}</h2>
        <Button variant="ghost" className="duo-btn-icon" style={{ width: 40, minHeight: 40 }} aria-label="Next month" disabled={month >= view.today.slice(0, 7)} onClick={() => go(1)}><ChevronRight size={18} aria-hidden="true" /></Button>
      </div>
      {target !== null && <div style={{ alignSelf: "center" }}><Pill tone="sky">{done} of {target} office days</Pill></div>}
      <div role="grid" aria-label={`Your days in ${fmt(`${month}-01`, { month: "long", year: "numeric" })}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} aria-hidden="true" style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: "var(--duo-muted)" }}>{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`pad-${i}`} />)}
        {view.days.map((day) => {
          const canFix = day.fixable && day.working;
          const locked = !canFix && day.working && day.date < view.fixableFrom;
          const what = day.mode ? MODE_LABEL[day.mode] : day.leave ? `leave, ${day.leave}` : day.planned ? "planned office day" : day.off ? day.off : "nothing marked";
          const label = `${fmt(day.date, { day: "numeric", month: "long" })}: ${what}${day.late ? ", added later" : ""}`;
          const base: React.CSSProperties = { position: "relative", height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600, padding: 0, color: "var(--duo-ink)", background: "transparent", ...dayStyle(day, view.today, canFix) };
          const dot = day.late && <span aria-hidden="true" style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: 4, background: "var(--duo-gold)" }} />;
          const n = Number(day.date.slice(8));
          if (canFix || locked) return (
            <button key={day.date} type="button" aria-label={`${label}. ${canFix ? "Fix this day" : "Locked"}`} style={{ ...base, cursor: "pointer" }} onClick={() => (canFix ? onPick(day) : onLocked(day))}>{n}{dot}</button>
          );
          return <span key={day.date} role="gridcell" aria-label={label} aria-current={day.date === view.today ? "date" : undefined} style={base}>{n}{dot}</span>;
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }} aria-hidden="true">
        {[["In office", { background: "var(--duo-green)", border: "2px solid var(--duo-green-edge)" }], ["Remote", { background: "var(--duo-sky)", border: "2px solid var(--duo-sky-edge)" }], ["Planned", { border: "2px dashed var(--duo-primary)" }], ["Leave", { background: "var(--duo-pink)", border: "2px solid var(--duo-pink-edge)" }], ["Today", { border: "2px solid var(--duo-ink)" }]].map(([label, style]) => (
          <span key={label as string} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--duo-muted)" }}><span style={{ width: 16, height: 16, borderRadius: 6, ...(style as React.CSSProperties) }} />{label as string}</span>
        ))}
      </div>
    </Card>
  );
}

function FixSheet({ day, onClose }: { day: Day; onClose: () => void }) {
  const mark = useMarkDay();
  const [choice, setChoice] = useState<"office" | "remote" | "none">(day.mode ?? "office");
  const label = short(day.date);
  const save = () => mark.mutate({ mode: choice, date: day.date }, {
    onSuccess: () => { toast.success(choice === "none" ? `${label} cleared` : `${label} marked ${MODE_LABEL[choice]}`); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Sheet label="Fix a day" onClose={onClose}>
      <h2 className="duo-h2" style={{ fontSize: 22 }}>{label}</h2>
      <span className="duo-sub">{day.mode ? `Marked ${MODE_LABEL[day.mode]}. Change it?` : "Nothing is marked for this day. Where were you?"}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="radiogroup" aria-label="Where were you?">
        {(["office", "remote", "none"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={choice === m} className="duo-chip" aria-pressed={choice === m} onClick={() => setChoice(m)}>{m === "none" ? "Not working" : MODE_LABEL[m]}</button>
        ))}
      </div>
      <Flat style={{ padding: 12 }}><span className="duo-sub" style={{ fontSize: 12 }}>Marked later, so there's no location check. Admins can see it was added after the day. Every change is logged.</span></Flat>
      <Button style={{ width: "100%" }} disabled={mark.isPending} onClick={save}>Save {label}</Button>
    </Sheet>
  );
}

function LockedSheet({ day, onClose }: { day: Day; onClose: () => void }) {
  return (
    <Sheet label="Day locked" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Tile tone="gold"><Lock size={22} /></Tile><h2 className="duo-h2" style={{ fontSize: 21 }}>{short(day.date)} is locked</h2></div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>You can fix your own last 7 days. Anything older needs an admin, who can change it from People & office days.</p>
      <Button style={{ width: "100%" }} onClick={onClose}>OK</Button>
    </Sheet>
  );
}

function OfficeDaysCard({ view }: { view: DaysView }) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<number[]>(view.officeDays);
  const save = useSetOfficeDays();
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>Your office days</span>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 22, fontWeight: 700, color: "var(--duo-brand)" }}>{scheduleLabel(view.officeDays)}</span>
        <span className="duo-sub" style={{ fontSize: 12 }}>Teammates see who's expected each day.</span>
      </div>
      <Button variant="ghost" onClick={() => { setPicked(view.officeDays); setEditing(true); }}>{view.officeDays.length ? "Change days" : "Set your days"}</Button>
      {editing && (
        <Sheet label="Your office days" onClose={() => setEditing(false)}>
          <h2 className="duo-h2" style={{ fontSize: 22 }}>My office days</h2>
          <span className="duo-sub">Pick the days you usually come in. Teammates see who's expected each day.</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {WEEKDAY_CHIPS.map((label, i) => (
              <button key={label} type="button" className="duo-chip" aria-pressed={picked.includes(i)} onClick={() => setPicked((p) => (p.includes(i) ? p.filter((d) => d !== i) : [...p, i]))}>{label}</button>
            ))}
          </div>
          <Button style={{ width: "100%" }} disabled={save.isPending} onClick={() => save.mutate(picked, { onSuccess: () => { toast.success("Office days saved"); setEditing(false); }, onError: (e) => toast.error(e.message) })}>Save</Button>
        </Sheet>
      )}
    </Card>
  );
}

const LEAVE_NAME: Record<string, string> = { cl: "Casual leave", sl: "Sick leave", el: "Earned leave", fl: "Flexible leave", ml: "Maternity leave" };
const STATUS: Record<MyLeaveRequest["status"], [string, Tone]> = { pending: ["Pending", "gold"], approved: ["Approved", "green"], rejected: ["Rejected", "pink"], cancelled: ["Cancelled", "soft"] };
const range = (r: MyLeaveRequest) => `${r.startDate === r.endDate ? short(r.startDate) : `${fmt(r.startDate, { weekday: "short", day: "numeric" })} – ${short(r.endDate)}`} · ${r.halfDay ? "half day" : `${r.days} day${r.days === 1 ? "" : "s"}`}`;

function LeaveCard() {
  const balances = useLeaveBalances();
  const tones: Record<string, Tone> = { cl: "sky", sl: "green", el: "gold", fl: "grape" };
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="duo-h2">Leave balance</h2>
      {balances.isPending ? <div className="duo-flat" style={{ height: 120 }} aria-busy="true" /> : balances.isError ? (
        <span className="duo-sub" role="alert">{balances.error.message}</span>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {(balances.data.ledger ?? []).map((row) => (
            <div key={row.type} className={`duo-tone-${tones[row.type] ?? "soft"}`} style={{ borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{row.remaining}</span>
              <span style={{ fontSize: 12, fontWeight: 800 }}>of {row.entitled} {row.type.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
      <Link href="/attendance?tab=leave" className="duo-btn duo-btn-p" style={{ width: "100%" }}>Request leave</Link>
      <span className="duo-sub" style={{ fontSize: 12 }}>Leave days don't count toward your 8 office days, so plan to make them up.</span>
    </Card>
  );
}

function Requests() {
  const requests = useMyLeaveRequests();
  const rows = (requests.data ?? []).filter((r) => r.type === "leave").slice(0, 6);
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h2 className="duo-h2">Your requests</h2>
      {requests.isError ? <span className="duo-sub" role="alert">{requests.error.message}</span> : rows.length === 0 ? (
        <span className="duo-sub" style={{ padding: "8px 0" }}>{requests.isPending ? "Loading…" : "No leave requests yet."}</span>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "2px solid var(--duo-line)" }}>
              <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>{LEAVE_NAME[r.leaveType ?? ""] ?? "Leave"}</span>
                <span className="duo-sub" style={{ fontSize: 13 }}>{range(r)}</span>
              </span>
              <Pill tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DaysPage() {
  const params = useSearchParams();
  const raw = params.get("month");
  const days = useDays(raw && MONTH.test(raw) ? raw : undefined);
  const [fixing, setFixing] = useState<Day | null>(null);
  const [locked, setLocked] = useState<Day | null>(null);
  const month = days.data?.month ?? raw ?? "";

  if (days.isPending) return <div className="duo-col" aria-busy="true" aria-label="Loading your days"><PageHeader title="Days" actions={<BellLink />} /><div className="duo-flat" style={{ height: 420 }} /></div>;
  if (days.isError) return (
    <div className="duo-col"><PageHeader title="Days" actions={<BellLink />} />
      <Card role="alert" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <span className="duo-h2">Couldn't load your days</span><span className="duo-sub">{days.error.message}</span><Button onClick={() => days.refetch()}>Try again</Button>
      </Card>
    </div>
  );

  const view = days.data;
  return (
    <>
      <div className="duo-col duo-with-rail duo-screen-in">
        <PageHeader title="Days" subtitle="Your office days, calendar and leave" actions={<BellLink />} />
        <Calendar view={view} month={month} onPick={setFixing} onLocked={setLocked} />
        <Flat style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
          <Pencil size={18} style={{ color: "var(--duo-muted)", flexShrink: 0 }} aria-hidden="true" />
          <span className="duo-sub" style={{ fontSize: 12 }}>Missed a day? Tap any of your last 7 days to fix it. Raised days are the ones you can change.</span>
        </Flat>
        <OfficeDaysCard key={view.officeDays.join(",")} view={view} />
        <Requests />
        {/* Below 1100px the laptop's right rail drops under the main column, in the same order. */}
        <div className="duo-rail-hide" style={{ display: "contents" }}><Battery days={view} /><LeaveCard /></div>
      </div>
      <aside className="duo-rail" aria-label="This month" style={{ paddingTop: 66 }}>
        <Battery days={view} />
        <LeaveCard />
      </aside>
      {fixing && <FixSheet key={fixing.date} day={fixing} onClose={() => setFixing(null)} />}
      {locked && <LockedSheet day={locked} onClose={() => setLocked(null)} />}
    </>
  );
}
