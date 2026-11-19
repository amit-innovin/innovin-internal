"use client";
// Shared pieces of the admin app (prototype: docs/design/m3/M3AdminApp.dc.html).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

const IST = "Asia/Kolkata";
export const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
export const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);
// "Tue 17 Nov" for a YYYY-MM-DD date.
export const dayLabel = (date: string, o: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(new Date(`${date}T00:00:00Z`));
// "11:00 AM" for "11:00".
export const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
// "12:00" → "12:00", "09:30" → "9:30".
export const hm = (t: string) => (t ? `${Number(t.split(":")[0])}:${t.split(":")[1]}` : "");
// Wall-clock "11:42" in office time for an ISO instant.
export const clockIST = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${Number(get("hour"))}:${get("minute")}`;
};
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The snackbar at the bottom of the admin app: one message at a time.
const SnackContext = createContext<(text: string) => void>(() => {});
export const useSnack = () => useContext(SnackContext);
export function SnackProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 4000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <SnackContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">{text && <div className="m3a-snack">{text}</div>}</div>
    </SnackContext.Provider>
  );
}

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <h1 className="m3a-h1">{title}</h1>
      {sub && <span className="m3-body" style={{ fontSize: 14, lineHeight: "20px", color: "var(--m3-on-surface-variant)" }}>{sub}</span>}
    </header>
  );
}

export function Switch({ on, onToggle, labelledBy, disabled }: { on: boolean; onToggle: () => void; labelledBy: string; disabled?: boolean }) {
  return <button type="button" role="switch" className="m3a-switch" aria-checked={on} aria-labelledby={labelledBy} disabled={disabled} onClick={onToggle} />;
}

// Filter chips with a check on the selected one.
export function Chips<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(([v, text]) => (
        <button key={v} type="button" className="m3a-chip" aria-pressed={value === v} onClick={() => onPick(v)}>
          {value === v && <Check size={16} strokeWidth={2.2} aria-hidden="true" />}{text}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ label, value, options, onPick, style }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void; style?: React.CSSProperties }) {
  return (
    <div className="m3a-tabs" role="tablist" aria-label={label} style={style}>
      {options.map(([v, text]) => <button key={v} type="button" role="tab" className="m3a-tabbtn" aria-selected={value === v} onClick={() => onPick(v)}>{text}</button>)}
    </div>
  );
}

export function Loading({ what, error, onRetry }: { what: string; error?: Error | null; onRetry: () => void }) {
  if (!error) return <div aria-busy="true" aria-label={`Loading ${what}`} className="m3a-card m3a-narrow" style={{ height: 160 }} />;
  return (
    <div role="alert" className="m3a-card m3a-narrow" style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <span className="m3-title">Couldn&apos;t load {what}</span>
      <span className="m3-small">{error.message}</span>
      <button type="button" className="m3-btn m3-btn-filled" onClick={onRetry}>Try again</button>
    </div>
  );
}

// The signed-in admin's email (the admin switch can't be turned off for yourself).
export const MeContext = createContext("");
export const useMe = () => useContext(MeContext);
