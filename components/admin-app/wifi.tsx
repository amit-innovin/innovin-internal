"use client";
// Admin › Wi-Fi reports: slow reports by day and area, anonymous.
import { useState } from "react";
import { useWifiReports, type WifiReport } from "@/lib/queries";
import { Chips, Loading, PageHead, dayLabel, istDay, todayIST } from "./ui";

const speed = (v: number | null | undefined) => (v == null ? "–" : v < 10 ? v.toFixed(1) : String(Math.round(v)));

export function WifiPage() {
  const reports = useWifiReports();
  const [show, setShow] = useState<"today" | "week">("today");
  if (!reports.data) return <><PageHead title="Wi-Fi reports" /><Loading what="Wi-Fi reports" error={reports.error} onRetry={() => reports.refetch()} /></>;
  const today = todayIST();
  const weekStart = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  const slow = reports.data.filter((r) => r.quality === "poor");
  const week = slow.filter((r) => istDay(r.createdAt) >= weekStart);
  const todays = week.filter((r) => istDay(r.createdAt) === today);
  const areas = new Map<string, number>();
  for (const r of week) if (r.area) areas.set(r.area, (areas.get(r.area) ?? 0) + 1);
  const top = [...areas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const rows: WifiReport[] = show === "today" ? todays : week;
  return (
    <>
      <PageHead title="Wi-Fi reports" />
      {top && <p className="m3-body" style={{ margin: 0 }}>Most reported this week: {top}</p>}
      <Chips label="Filter reports" value={show} onPick={setShow} options={[["today", `Today ${todays.length}`], ["week", `This week ${week.length}`]]} />
      <section aria-label="Reports" className="m3a-card m3a-flush">
        <div className="m3a-wrow m3a-whead" aria-hidden="true"><span>Day</span><span>Area</span><span>Down / up</span><span>Note</span></div>
        <ul className="m3a-list">
          {rows.map((r) => (
            <li key={r.id} className="m3a-wrow m3a-topline">
              <span className="m3-small" style={{ color: "var(--m3-on-surface)" }}>{istDay(r.createdAt) === today ? "Today" : dayLabel(istDay(r.createdAt))}</span>
              <span className="m3a-warea">{r.area ?? "Area not given"}</span>
              <span style={{ fontWeight: 600 }}><span aria-hidden="true">{speed(r.downMbps)} / {speed(r.upMbps)} Mbps</span><span className="vh">{speed(r.downMbps)} megabits per second down, {speed(r.upMbps)} up</span></span>
              <span className="m3a-wnote m3-body" style={{ color: r.note ? "var(--m3-on-surface)" : "var(--m3-on-surface-variant)" }}>{r.note || "No note"}</span>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="m3-body" style={{ margin: 0, padding: "16px 20px", color: "var(--m3-on-surface-variant)" }}>No slow reports {show === "today" ? "today" : "this week"}.</p>}
      </section>
    </>
  );
}
