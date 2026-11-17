"use client";
// Shared pieces of the admin area, ported from D-AdminPhone, D-AdminDesktop and D-AdminDesk-*.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Pill, type Tone } from "@/components/duo";
import { Sheet } from "@/components/duo/sheet";
import { readError, send } from "@/lib/fetcher";
import type { OfficeDayStatus } from "@/lib/office-days";
import { useAdminPerson, type PersonRow } from "@/lib/queries";

const IST = "Asia/Kolkata";
export const fmtDay = (date: string, o: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(new Date(`${date}T00:00:00Z`));
export const fmtClock = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const monthName = (month: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(new Date(`${month}-01T00:00:00Z`));

export const STATUS: Record<OfficeDayStatus, [string, Tone]> = { behind: ["Behind", "pink"], "on-track": ["On track", "sky"], done: ["Done", "green"], exempt: ["Exempt", "soft"] };
export const TODAY_LABEL = { office: "Office", leave: "Leave" } as const;
export const toneBg = (tone: Tone) => (tone === "gold" ? "var(--duo-gold-soft)" : tone === "soft" ? "var(--duo-soft)" : `var(--duo-${tone})`);

export function StatusPill({ status }: { status: OfficeDayStatus }) {
  return <Pill tone={STATUS[status][1]}>{STATUS[status][0]}</Pill>;
}

// "3/8" with eight little bars, as in the office-days table.
export function Bars8({ done, target }: { done: number; target: number | null }) {
  if (target === null) return <span className="duo-sub" style={{ fontSize: 13 }}>no target</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} aria-label={`${done} of ${target} office days`}>
      {Array.from({ length: target }, (_, j) => <span key={j} aria-hidden="true" style={{ width: 7, height: 16, borderRadius: 3, background: j < done ? "var(--duo-seg-on)" : "var(--duo-line)" }} />)}
      <span aria-hidden="true" style={{ fontFamily: "var(--duo-display)", fontSize: 14, fontWeight: 700, marginLeft: 4 }}>{done}/{target}</span>
    </span>
  );
}

// A big number on a soft tile. Flat: it informs, it isn't a button.
export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub: string; tone: Tone }) {
  return (
    <div className={`duo-tone-${tone}`} style={{ borderRadius: 20, padding: 14, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span className="duo-tag" style={{ color: "inherit" }}>{label}</span>
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 800 }}>{sub}</span>
    </div>
  );
}

// Phone admin sub-pages go back to the hub; on laptop the sidebar does that job.
export function AdminHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <Link href="/admin" aria-label="Back to admin" className="duo-btn duo-btn-g duo-btn-icon duo-sm-only" style={{ width: 46 }}><ChevronLeft size={20} aria-hidden="true" /></Link>
      <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 className="duo-h1">{title}</h1>
        <span className="duo-sub">{subtitle}</span>
      </div>
      {actions}
    </header>
  );
}

export function useAdminRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["admin"] });
}

async function post(url: string, method: "POST" | "PATCH", json: unknown) {
  const res = await send(url, { method, json });
  if (!res.ok) throw new Error(await readError(res));
}

const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

// "Fix someone's day" / "Fix an older day": any person, any day up to today, logged.
export function FixDaySheet({ people, start, onClose }: { people: PersonRow[]; start?: { email?: string; date?: string }; onClose: () => void }) {
  const [email, setEmail] = useState(start?.email ?? "");
  const [date, setDate] = useState(start?.date ?? todayIST());
  const [busy, setBusy] = useState(false);
  const refresh = useAdminRefresh();
  const save = async (mode: "office" | "none") => {
    if (!email) return toast.error("Pick a person");
    setBusy(true);
    try {
      await post("/api/admin/days", "POST", { email, date, mode });
      toast.success(mode === "none" ? "Marked not in office" : "Marked in office");
      refresh();
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet label="Fix a day" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <h2 className="duo-h2" style={{ fontSize: 22, flexGrow: 1 }}>Fix a day</h2>
        <button type="button" aria-label="Close" className="duo-btn duo-btn-text" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Person</span>
        <select className="duo-input" value={email} onChange={(e) => setEmail(e.target.value)}>
          <option value="">Pick someone</option>
          {[...people].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Day</span>
        <input type="date" className="duo-input" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <Button disabled={busy} onClick={() => save("office")}>In office</Button>
        <Button variant="ghost" disabled={busy} onClick={() => save("none")}>Not in office</Button>
      </div>
      <span className="duo-sub" style={{ fontSize: 12 }}>Every change you make is logged with your name.</span>
    </Sheet>
  );
}

// The selected person: their month, and the three admin actions.
export function PersonPanel({ person, month, onFix }: { person: PersonRow; month: string; onFix: () => void }) {
  const detail = useAdminPerson(person.email, month);
  const refresh = useAdminRefresh();
  const [busy, setBusy] = useState(false);
  const act = async (json: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await post("/api/people", "PATCH", { email: person.email, ...json }); toast.success(ok); refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const lead = (Number(new Date(`${month}-01T00:00:00Z`).getUTCDay()) + 6) % 7;
  const [statusLabel, tone] = STATUS[person.status];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ borderRadius: 999, background: toneBg(tone) }}><Avatar name={person.name} size={48} /></span>
        <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 19, fontWeight: 700 }}>{person.name}</span>
          <span className="duo-sub" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{person.email} · {person.role === "admin" ? "Admin" : "Member"}</span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill tone={tone}>{person.target === null ? statusLabel : `${person.done} of ${person.target} · ${statusLabel.toLowerCase()}`}</Pill>
        <Pill tone="soft">{person.schedule}</Pill>
      </div>
      <div role="grid" aria-label={`${person.name}, ${monthName(month)}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 }}>
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {(detail.data?.days ?? []).map((d) => (
          <span key={d.date} role="gridcell" aria-label={`${fmtDay(d.date)}: ${d.mode ?? (d.working ? "not marked" : "office closed")}`}
            style={{ height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--duo-display)", fontSize: 12, fontWeight: 600, boxSizing: "border-box",
              ...(d.mode === "office" ? { background: "var(--duo-green)", color: "var(--duo-green-text)" } : d.mode === "leave" ? { background: "var(--duo-gold-soft)", color: "var(--duo-gold-text)" } : { color: d.working ? "var(--duo-ink)" : "var(--duo-line)" }) }}>
            {Number(d.date.slice(8))}
          </span>
        ))}
      </div>
      {detail.isPending && <span className="duo-sub" style={{ fontSize: 12 }}>Loading the month…</span>}
      <Button onClick={onFix} style={{ width: "100%" }}><Pencil size={18} aria-hidden="true" />Fix a day</Button>
      <Button variant="ghost" disabled={busy} style={{ width: "100%", fontSize: 15 }} onClick={() => act({ officeExempt: !person.exempt }, person.exempt ? `${person.name} has the 8-day target again` : `${person.name} is exempt`)}>
        {person.exempt ? "Give back the 8-day target" : "Mark exempt from the 8 days"}
      </Button>
      <Button variant="ghost" disabled={busy} style={{ width: "100%", fontSize: 15 }} onClick={() => act({ role: person.role === "admin" ? "member" : "admin" }, person.role === "admin" ? `${person.name} is a member now` : `${person.name} is an admin now`)}>
        <ShieldCheck size={18} aria-hidden="true" />{person.role === "admin" ? "Remove admin" : "Make admin"}
      </Button>
      {/* Only day fixes are logged (attendance_changes), so the note says exactly that. */}
      <span className="duo-sub" style={{ fontSize: 12 }}>Every day you fix is logged with your name.</span>
    </div>
  );
}

// CSV of the office-days table, built in the browser from what the admin already sees.
export function exportCsv(people: PersonRow[], month: string) {
  const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = [["Name", "Email", "Role", "Office days", "Today", "Done", "Target", "Status"], ...people.map((p) => [p.name, p.email, p.role, p.schedule, p.today ?? "", p.done, p.target ?? "", STATUS[p.status][0]])];
  const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `office-days-${month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Laptop layout (≥1100px) or not. False on the server and the first paint.
export function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export function Panel({ children }: { children: ReactNode }) {
  return <Card style={{ padding: 14 }}>{children}</Card>;
}
