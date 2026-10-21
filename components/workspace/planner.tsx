"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getJSON, readError, send } from "@/lib/fetcher";
import { holidaysFor } from "@/lib/leave";
import type { PlannerDay, PlannerKind } from "@/lib/types";
import { PLANNER_ICONS, PLANNER_LABELS } from "@/lib/workspace-model";

export function WorkspacePlanner({ today }: { today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [days, setDays] = useState<PlannerDay[] | null>(null);
  const [selected, setSelected] = useState<string | null>(today);
  const [busy, setBusy] = useState(false);
  const loadVersion = useRef(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const year = Number(month.slice(0, 4)), m = Number(month.slice(5));
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const offset = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const load = useCallback(async () => { const version=++loadVersion.current; setLoadFailed(false); const result = await getJSON<PlannerDay[]>(`/api/planner?from=${month}-01&to=${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()).padStart(2, "0")}`, "your planner", { fresh: true }); if(version!==loadVersion.current)return; if (result) setDays(result); else setLoadFailed(true); }, [month]);
  useEffect(() => { setDays(null); load(); }, [load]);
  const shift = (n: number) => { const date = new Date(Date.UTC(year, m - 1 + n, 1)); setMonth(date.toISOString().slice(0, 7)); setSelected(date.toISOString().slice(0,10)); };
  const setDay = async (kind: PlannerKind | "clear") => {
    if (!selected || busy) return; setBusy(true);
    const res = await send("/api/planner", { method: "POST", json: { date: selected, kind } });
    if (!res.ok) toast.error(await readError(res)); else { await load(); toast.success("Calendar updated"); }
    setBusy(false);
  };
  return <div className="planner-layout calendar-layout-grid"><section className="studio-card"><div className="studio-card-heading"><div><p className="studio-eyebrow">MAKE SPACE FOR YOUR LIFE</p><h2><CalendarDays size={19} />Presence & leave calendar</h2></div><div className="calendar-month"><button className="studio-icon-button" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={18} /></button><h3>{label}</h3><button className="studio-icon-button" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={18} /></button></div></div>
    <div className="calendar-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span className="calendar-weekday" key={d}>{d}</span>)}{Array.from({ length: offset }, (_, i) => <div key={`empty-${i}`} />)}{Array.from({ length: count }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, "0")}`; const kind = days?.find((d) => d.date === date)?.kind; const holiday = holidaysFor(year)[date]; return <button key={date} aria-label={`Select ${date}`} disabled={!days || busy} className={`calendar-day ${date === today ? "today" : ""} ${kind ? `kind-${kind}` : ""}`} onClick={() => setSelected(date)}><span>{i + 1}</span>{kind ? <><b>{PLANNER_ICONS[kind]}</b><small>{PLANNER_LABELS[kind]}</small></> : holiday ? <><b>🎉</b><small>{holiday}</small></> : null}</button>; })}</div>
    {!days && <p className="p-5 text-center text-sm text-muted-foreground">{loadFailed ? <button onClick={load} className="studio-text-button">Couldn&apos;t load your calendar. Try again.</button> : "Loading your plans…"}</p>}
    <div className="calendar-legend">{(Object.keys(PLANNER_LABELS) as PlannerKind[]).map((k) => <span key={k}>{PLANNER_ICONS[k]} {PLANNER_LABELS[k]}</span>)}</div>
  </section><aside><section className="widget-card cal-sidebar-card"><div className="widget-header"><h2 className="widget-title">Quick Status Setter</h2></div><div className="selected-day-inspector"><div className="inspector-date-badge">{selected ? new Intl.DateTimeFormat("en",{weekday:"long",month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(`${selected}T12:00:00Z`)) : "Select a day"}</div><p className="inspector-note">Select status for this date:</p><div className="status-selector-buttons">{(Object.keys(PLANNER_LABELS) as PlannerKind[]).map(k=><button key={k} className={`status-btn opt-${k==="remote"?"wfh":k==="vacation"?"casual":k}`} disabled={busy||!selected||!days} onClick={()=>setDay(k)}>{PLANNER_ICONS[k]} {PLANNER_LABELS[k]}</button>)}<button className="status-btn opt-clear" disabled={busy||!selected||!days} onClick={()=>setDay("clear")}>Clear day</button></div></div></section><section className="studio-card p-6"><p className="studio-eyebrow">YOUR MONTH, AT A GLANCE</p><h2 className="text-xl mt-3 font-semibold">A little balance goes a long way.</h2><div className="planner-stats">{([["office", "Office days planned"], ["remote", "WFH days planned"], ["vacation", "Vacation days planned"]] as const).map(([k, text]) => <div key={k}><span>{text}</span><strong>{days ? days.filter((d) => d.kind === k).length : "—"}</strong></div>)}</div><p className="studio-notice">Personal plans don&apos;t change attendance or HR approval. Submit formal leave in Attendance, where your Zoho balance and approval status are shown.</p><Link className="studio-button mt-5" href="/attendance">Attendance & leave requests ↗</Link></section><p className="text-sm text-muted-foreground px-2 mt-5">Select a day to set your status. Plans are private to your account.</p></aside>

  </div>;
}
