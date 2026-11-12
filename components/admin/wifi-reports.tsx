"use client";
import { Card, Pill, QueryState } from "@/components/duo";
import { relativeTime } from "@/lib/format";
import { useWifiReports, type WifiReport } from "@/lib/queries";
import { AdminHeader, StatTile, fmtClock, fmtDay } from "./admin-ui";

const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);
const mbps = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)} Mbps`);
function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const isWeekday = (date: string) => { const d = new Date(`${date}T00:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; };

// D-AdminDesk-Wifi. Not drawn for the phone; there the table becomes a list.
export function WifiReports() {
  const reports = useWifiReports();
  const today = istDay(new Date().toISOString());
  const head = <AdminHeader title="Wi-Fi reports" subtitle={reports.data ? `${fmtDay(today)} · ${reports.data.filter((r) => istDay(r.createdAt) === today).length} reports today` : "Loading…"} />;
  if (!reports.data) return <div className="duo-col">{head}<QueryState error={reports.error} onRetry={() => reports.refetch()} what="Wi-Fi reports" /></div>;
  const all = reports.data;
  const todays = all.filter((r) => istDay(r.createdAt) === today);
  const poor = todays.filter((r) => r.quality === "poor");
  const typical = median(todays.map((r) => r.downMbps).filter((v): v is number => v != null));
  const slowest = todays.filter((r) => r.downMbps != null).sort((a, b) => (a.downMbps ?? 0) - (b.downMbps ?? 0))[0] as WifiReport | undefined;

  // Poor reports over the last five working days, newest first.
  const days: string[] = [];
  for (let i = 0; days.length < 5 && i < 14; i += 1) { const d = istDay(new Date(Date.now() - i * 86_400_000).toISOString()); if (isWeekday(d)) days.push(d); }
  const perDay = days.map((d) => ({ d, n: all.filter((r) => r.quality === "poor" && istDay(r.createdAt) === d).length }));
  const most = Math.max(1, ...perDay.map((p) => p.n));
  const when = (r: WifiReport) => (istDay(r.createdAt) === today ? fmtClock(r.createdAt) : relativeTime(r.createdAt));

  return (
    <div className="duo-page duo-screen-in">
      <div className="duo-page-head">{head}</div>
      <div className="duo-page-main">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <StatTile label="Poor today" value={poor.length} sub={`of ${todays.length} report${todays.length === 1 ? "" : "s"}`} tone="pink" />
          <StatTile label="Typical speed" value={typical == null ? "—" : Math.round(typical)} sub="Mbps down, median today" tone="sky" />
          <StatTile label="Slowest" value={slowest?.downMbps == null ? "—" : Math.round(slowest.downMbps)} sub={slowest ? `Mbps · ${slowest.note || "no location"}` : "no speeds today"} tone="gold" />
        </div>
        <Card className="duo-lg-only" style={{ padding: 6, flexDirection: "column" }}>
          <table className="duo-table">
            <thead><tr>{["When", "Feels", "Down", "Up", "Where"].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {all.slice(0, 30).map((r) => (
                <tr key={r.id} style={{ cursor: "default" }}>
                  <td>{when(r)}</td>
                  <td><Pill tone={r.quality === "good" ? "green" : "pink"}>{r.quality === "good" ? "Good" : "Poor"}</Pill></td>
                  <td>{mbps(r.downMbps)}</td>
                  <td>{mbps(r.upMbps)}</td>
                  <td>{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {all.length === 0 && <span className="duo-sub" style={{ padding: 12 }}>No reports yet.</span>}
        </Card>
        <Card className="duo-sm-only" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {all.length === 0 && <span className="duo-sub">No reports yet.</span>}
          {all.slice(0, 30).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "2px solid var(--duo-line)" }}>
              <Pill tone={r.quality === "good" ? "green" : "pink"}>{r.quality === "good" ? "Good" : "Poor"}</Pill>
              <span style={{ flexGrow: 1, fontSize: 14, fontWeight: 700 }}>{[r.note || null, r.downMbps != null ? mbps(r.downMbps) : null].filter(Boolean).join(" · ") || "No details"}</span>
              <span className="duo-sub" style={{ fontSize: 12 }}>{when(r)}</span>
            </div>
          ))}
        </Card>
      </div>
      <aside className="duo-page-rail">
        <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>Poor reports, last 5 working days</span>
          {perDay.map(({ d, n }) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 36, fontFamily: "var(--duo-display)", fontSize: 14, fontWeight: 600 }}>{fmtDay(d, { weekday: "short" })}</span>
              <span style={{ flexGrow: 1, height: 12, borderRadius: 6, background: "var(--duo-soft)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(100 * n) / most}%`, background: "var(--duo-pink-edge)", borderRadius: 6 }} /></span>
              <span style={{ width: 16, textAlign: "right", fontFamily: "var(--duo-display)", fontWeight: 700 }}>{n}</span>
            </div>
          ))}
          <span className="duo-sub" style={{ fontSize: 12 }}>Reports carry no name. People add the room if they want to.</span>
        </Card>
      </aside>
    </div>
  );
}
