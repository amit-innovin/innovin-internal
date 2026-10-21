"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getJSON } from "@/lib/fetcher";
import type { LeaveSummary } from "@/lib/leave-data";

export function LeaveChips() {
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  useEffect(() => { let alive = true; getJSON<LeaveSummary>("/api/leave", "your leave balance").then(s => { if (alive) setSummary(s); }); return () => { alive = false; }; }, []);
  return <div className="card-leave-balances">{[["cl", "Casual", "casual"], ["sl", "Sick", "sick"], ["fl", "Festive", "festive"]].map(([type, label, color]) => {
    const row = summary?.ledger.find(l => l.type === type);
    const verified = summary?.source === "zoho-snapshot";
    return <Link key={type} href="/attendance" className={`leave-balance-card card-${color}`} title={verified ? `Zoho snapshot: ${summary.asOf?.slice(0, 10)}` : "Ask an admin to add your Zoho balance"}><div className="leave-card-top"><span className={`leave-indicator-dot ${color}`} /><span className="leave-card-label">{label}</span></div><div className="leave-card-val"><strong className="leave-count">{verified ? row?.remaining ?? "—" : "—"}</strong><span className="leave-total">{verified && row ? `/ ${row.entitled}` : ""}</span></div><span className="leave-subtext">{verified ? "snapshot balance" : "Zoho not synced"}</span></Link>;
  })}</div>;
}
