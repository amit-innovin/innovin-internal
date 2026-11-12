"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Avatar, Button, Pill, QueryState } from "@/components/duo";
import { useAdminOverview, type PersonRow } from "@/lib/queries";
import { AdminHeader, FixDaySheet, StatTile, fmtClock, fmtDay } from "./admin-ui";
import { ChaiRound } from "./overview-page";

const FILTERS = [["all", "All"], ["office", "In office"], ["remote", "Remote"], ["leave", "On leave"], ["none", "Not marked"]] as const;
type Filter = (typeof FILTERS)[number][0];
const LEAVE: Record<string, string> = { cl: "Casual Leave", sl: "Sick Leave", el: "Earned Leave", fl: "Flexible Leave", ml: "Maternity Leave" };

function line(p: PersonRow) {
  if (p.today === "office") return `In office${p.markedAt ? ` · marked ${fmtClock(p.markedAt)}` : ""}`;
  if (p.today === "remote") return `Remote${p.markedAt ? ` · marked ${fmtClock(p.markedAt)}` : ""}`;
  if (p.today === "leave") return `On leave${p.leaveType ? ` · ${LEAVE[p.leaveType] ?? p.leaveType}` : ""}`;
  return "Not marked yet";
}

// D-AdminPhone screen 3. On laptop this content is part of the Overview.
export function TodayPage() {
  const overview = useAdminOverview();
  const params = useSearchParams();
  const router = useRouter();
  const [fix, setFix] = useState<{ email?: string; date?: string } | null>(null);
  const filter: Filter = FILTERS.find(([f]) => f === params.get("show"))?.[0] ?? "all";
  const data = overview.data;
  if (!data) return <div className="duo-col"><AdminHeader title="Today" subtitle="Loading…" /><QueryState error={overview.error} onRetry={() => overview.refetch()} what="today" /></div>;
  const order = { office: 0, remote: 1, leave: 2, none: 3 } as const;
  const shown = data.people
    .filter((p) => filter === "all" || (filter === "none" ? p.today === null : p.today === filter))
    .sort((a, b) => order[a.today ?? "none"] - order[b.today ?? "none"] || a.name.localeCompare(b.name));
  return (
    <div className="duo-col duo-screen-in">
      <AdminHeader title="Today" subtitle={`${fmtDay(data.today)} · ${data.total} people`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <StatTile label="In office" value={data.counts.office} sub="checked in" tone="green" />
        <StatTile label="Remote" value={data.counts.remote} sub="working remote" tone="sky" />
        <StatTile label="On leave" value={data.counts.leave} sub="today" tone="gold" />
        <StatTile label="Not marked" value={data.counts.notMarked} sub="yet" tone="soft" />
      </div>
      <ChaiRound tea={data.tea} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 className="duo-h2" style={{ flexGrow: 1 }}>Everyone</h2>
        <Button variant="ghost" style={{ minHeight: 42, fontSize: 14 }} onClick={() => setFix({})}>Fix an older day</Button>
      </div>
      <div role="group" aria-label="Show" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map(([f, label]) => <button key={f} type="button" className="duo-chip" aria-pressed={filter === f} onClick={() => router.replace(f === "all" ? "/admin/today" : `/admin/today?show=${f}`, { scroll: false })}>{label}</button>)}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((p) => (
          <li key={p.email} className="duo-card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={p.name} size={36} />
            <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>{p.name}</span>
              <span className="duo-sub" style={{ fontSize: 12 }}>{line(p)}</span>
            </span>
            {p.today === "office" && <Pill tone="green">Office</Pill>}
            {p.today === "remote" && <Pill tone="sky">Remote</Pill>}
            {p.today === "leave" && <Pill tone="gold">Leave</Pill>}
            {p.today === null && <button type="button" className="duo-btn duo-btn-g duo-btn-icon" style={{ width: 40, minHeight: 40 }} aria-label={`Fix ${p.name}’s day`} onClick={() => setFix({ email: p.email, date: data.today })}><Pencil size={16} aria-hidden="true" /></button>}
          </li>
        ))}
        {shown.length === 0 && <li className="duo-sub">Nobody here.</li>}
      </ul>
      <span className="duo-sub" style={{ fontSize: 12 }}>Every day you fix is logged with your name.</span>
      {fix && <FixDaySheet people={data.people} start={fix} onClose={() => setFix(null)} />}
    </div>
  );
}
