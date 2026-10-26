"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getJSON } from "@/lib/fetcher";
import type { LeaveSummary } from "@/lib/leave-data";

type PersonalLeave = (LeaveSummary & { signedIn: true }) | { signedIn: false; year: number };

export function LeaveChips() {
  const [summary, setSummary] = useState<PersonalLeave | null>(null);
  useEffect(() => { let alive = true; getJSON<PersonalLeave>("/api/leave", "your leave balance").then(s => { if (alive) setSummary(s); }); return () => { alive = false; }; }, []);
  if (summary?.signedIn === false) return <a className="studio-notice" href="/api/auth/google?next=/">Your session ended. Sign in again.</a>;
  return <div className="card-leave-balances">{[["cl", "Casual", "casual"], ["sl", "Sick", "sick"], ["fl", "Festive", "festive"]].map(([type, label, color]) => {
    const row = summary?.ledger?.find(l => l.type === type);
    const live = summary?.zoho?.data;
    const liveRow = live?.balances.find(row => row.type === type);
    const verified = !!live || summary?.source === "zoho-snapshot";
    const title = live ? `Zoho last read: ${live.fetchedAt.slice(0, 16)}${summary?.zoho?.state === "stale" ? " (needs refresh)" : ""}` : summary?.zoho?.state === "unavailable" || summary?.zoho?.state === "unmapped" ? summary.zoho.message : verified ? `Manual Zoho snapshot: ${summary?.asOf?.slice(0, 10)}` : "Ask an admin to connect Zoho People";
    return <Link key={type} href="/attendance" className={`leave-balance-card card-${color}`} title={title}><div className="leave-card-top"><span className={`leave-indicator-dot ${color}`} /><span className="leave-card-label">{label}</span></div><div className="leave-card-val"><strong className="leave-count">{live ? liveRow?.remaining ?? "—" : verified ? row?.remaining ?? "—" : "—"}</strong><span className="leave-total">{!live && verified && row ? `/ ${row.entitled}` : ""}</span></div><span className="leave-subtext">{live ? summary?.zoho?.state === "stale" ? "Zoho · needs refresh" : "Zoho balance" : verified ? "manual snapshot" : "Zoho not synced"}</span></Link>;
  })}</div>;
}
