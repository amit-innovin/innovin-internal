"use client";
import { useWorkspaceReplace } from "@/components/m3/workspace-link";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusChip } from "@/components/m3";
import type { DaysView } from "@/lib/days";
import { paceVerdict, plannedCount } from "@/lib/pace";
import { addMonths, PLAN_MONTHS_AHEAD } from "@/lib/plan";
import { useLeaveBalances } from "@/lib/queries";
import { dayNumber, LEAVE_NAMES, longDay, monthName, monthTitle } from "./format";

export type Day = DaysView["days"][number];
// Tapping a date plans a day in or applies for leave (owner ruling): today offers leave only, and
// past dates do nothing. A missed day is fixed by an admin.
export type DayAction = "plan" | "today";

export function actionFor(view: DaysView, day: Day): DayAction | null {
  if (!day.working || day.leave) return null;
  if (day.date > view.today) return "plan";
  if (day.date === view.today) return view.me ? null : "today";
  return null;
}

const ACTION_TEXT: Record<DayAction, string> = { plan: "Tap to plan or apply for leave", today: "Tap to apply for leave" };

function stateText(day: Day) {
  if (day.mode === "office") return "done";
  if (day.leave === "approved") return "leave";
  if (day.leave === "pending") return "leave requested";
  if (day.closed) return `office closed: ${day.closed}`;
  if (day.planned) return "planned";
  return day.off;
}

function cellStyle(day: Day, today: boolean): CSSProperties {
  const base: CSSProperties = { width: 36, height: 36, borderRadius: 18, display: "grid", placeItems: "center", padding: 0, border: 0, background: "transparent", fontSize: 14, fontFamily: "inherit", color: "var(--m3-on-surface)", outline: today ? "2px solid var(--m3-on-surface)" : "none", outlineOffset: 2 };
  if (day.mode === "office") return { ...base, background: "var(--m3-primary)", color: "var(--m3-on-primary)", fontWeight: 600 };
  if (day.leave === "approved") return { ...base, background: "#EBDCFF", color: "#20142F", fontWeight: 600 };
  if (day.leave === "pending") return { ...base, border: "1.5px dashed #65587B", color: "#65587B", fontWeight: 600 };
  if (day.closed) return { ...base, background: "#E5E8EE", border: "1px dashed #9AA0A6", color: "#5D6369", fontWeight: 500 };
  if (day.planned) return { ...base, border: "1.5px solid var(--m3-primary)", color: "var(--m3-primary)", fontWeight: 700 };
  if (!day.working) return { ...base, color: "#6B7177" };
  return base;
}

const LEGEND: [string, CSSProperties][] = [
  ["Done", { background: "var(--m3-primary)" }],
  ["Planned", { border: "1.5px solid var(--m3-primary)" }],
  ["Leave", { background: "#EBDCFF" }],
];

const PACE_TONE = { success: "success", warn: "warn", neutral: "neutral" } as const;

export function Calendar({ view, onPick }: { view: DaysView; onPick: (day: Day, action: DayAction) => void }) {
  const replace = useWorkspaceReplace();
  const balances = useLeaveBalances();
  const { month, today } = view;
  const go = (by: number) => replace(`/days?month=${addMonths(month, by)}`, { scroll: false });
  const offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const pace = paceVerdict({ done: view.summary.done, planned: plannedCount(view), target: view.summary.target, month });
  const left = view.days.filter((d) => d.date >= today && d.working).length;
  const zoho = balances.data?.zoho;
  const ledger = (zoho?.data?.balances ?? balances.data?.ledger ?? []).filter((l) => l.type in LEAVE_NAMES);
  const checkedAt = zoho?.data?.fetchedAt ?? balances.data?.asOf;
  const source = zoho?.data ? (zoho.state === "stale" ? "Zoho People · last available" : "Zoho People")
    : balances.data?.source === "zoho-snapshot" ? "Copied Zoho balance" : "App estimate";

  return (
    <section aria-labelledby="days-month" className="m3-card" style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 2px" }}>
        <button type="button" className="m3-btn m3-btn-text" style={{ width: 44, padding: 0 }} aria-label="Previous month" disabled={month <= view.fixableFrom.slice(0, 7)} onClick={() => go(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
        <h2 id="days-month" className="m3-title" style={{ flex: 1, textAlign: "center" }}>{month.slice(0, 4) === today.slice(0, 4) ? monthName(month) : monthTitle(month)}</h2>
        <button type="button" className="m3-btn m3-btn-text" style={{ width: 44, padding: 0 }} aria-label="Next month" disabled={month >= addMonths(today.slice(0, 7), PLAN_MONTHS_AHEAD)} onClick={() => go(1)}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}><StatusChip tone={PACE_TONE[pace.tone]}>{pace.short}</StatusChip></div>
      {ledger.length > 0 && (
        <div role="group" aria-label="Leave left" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "0 6px" }}>
          <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}>Leave left</span>
          {ledger.map((l) => (
            <span key={l.type} style={{ height: 28, padding: "0 10px", borderRadius: 8, background: "#F1F4FA", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {LEAVE_NAMES[l.type]} <b style={{ fontVariantNumeric: "tabular-nums", color: l.type === "fl" ? "#8A5300" : "var(--m3-primary)" }}>{l.remaining ?? "—"}</b>
            </span>
          ))}
          <span className="m3-small" style={{ flexBasis: "100%" }}>{source}{checkedAt ? ` · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(checkedAt))}` : ""}</span>
        </div>
      )}
      {pace.state === "short" && month === today.slice(0, 7) && (
        <p className="m3-small" style={{ margin: "0 6px", color: "var(--m3-on-warn-container)" }}>{left} weekdays left in {monthName(month)}, including today. Tap a date to plan it.</p>
      )}
      <div role="group" aria-label={`Your days in ${monthTitle(month)}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", rowGap: 6, textAlign: "center" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} aria-hidden="true" style={{ fontSize: 12, fontWeight: 600, color: "var(--m3-on-surface-variant)" }}>{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`pad-${i}`} aria-hidden="true" />)}
        {view.days.map((day) => {
          const isToday = day.date === today;
          const action = actionFor(view, day);
          const state = stateText(day);
          const label = `${longDay(day.date)}${isToday ? ", today" : ""}${state ? `, ${state}` : ""}`;
          return (
            <div key={day.date} style={{ display: "grid", placeItems: "center", height: 40 }}>
              {action ? (
                <button type="button" aria-label={`${label}. ${ACTION_TEXT[action]}`} aria-current={isToday ? "date" : undefined} style={{ ...cellStyle(day, isToday), cursor: "pointer" }} onClick={() => onPick(day, action)}>{dayNumber(day.date)}</button>
              ) : (
                <span style={cellStyle(day, isToday)} aria-current={isToday ? "date" : undefined}><span aria-hidden="true">{dayNumber(day.date)}</span><span className="sr-only">{label}</span></span>
              )}
            </div>
          );
        })}
      </div>
      <div data-legend="" aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "0 6px", fontSize: 12, color: "var(--m3-on-surface-variant)" }}>
        {LEGEND.map(([name, swatch]) => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 6, boxSizing: "border-box", ...swatch }} />{name}</span>
        ))}
      </div>
    </section>
  );
}
