"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, MoreHorizontal, Search } from "lucide-react";
import { Avatar, Button, Card, QueryState } from "@/components/duo";
import { Sheet } from "@/components/duo/sheet";
import { useAdminOverview, type PersonRow } from "@/lib/queries";
import { AdminHeader, Bars8, FixDaySheet, PersonPanel, STATUS, StatTile, StatusPill, TODAY_LABEL, exportCsv, monthName, toneBg, useWide } from "./admin-ui";

const FILTERS = [["behind", "Behind first"], ["all", "Everyone"], ["exempt", "Exempt"]] as const;
type Filter = (typeof FILTERS)[number][0];

// D-AdminDesk-People (laptop) and "Office days" on D-AdminPhone. Filter and person live in the URL.
export function PeoplePage() {
  const overview = useAdminOverview();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fix, setFix] = useState<{ email?: string } | null>(null);
  const wide = useWide();
  const filter: Filter = (FILTERS.find(([f]) => f === params.get("show"))?.[0]) ?? "behind";
  const selectedEmail = params.get("person");
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key); else next.set(key, value);
    router.replace(`/admin/people${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const data = overview.data;
  const shown = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.people.filter((p) => (filter === "exempt" ? p.exempt : true) && (!needle || p.name.toLowerCase().includes(needle) || p.email.includes(needle)));
  }, [data, q, filter]);

  if (!data) return <div className="duo-col duo-screen-in"><AdminHeader title="People & office days" subtitle="Loading…" /><QueryState error={overview.error} onRetry={() => overview.refetch()} what="people" /></div>;
  const selected = data.people.find((p) => p.email === selectedEmail) ?? null;
  const pick = (p: PersonRow) => setParam("person", p.email === selectedEmail ? null : p.email);

  const tools = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <label style={{ flex: "1 1 200px", position: "relative" }}>
        <span style={{ position: "absolute", left: -9999 }}>Search people</span>
        <Search size={18} aria-hidden="true" style={{ position: "absolute", left: 14, top: 14, color: "var(--duo-muted)" }} />
        <input className="duo-input" style={{ height: 46, paddingLeft: 42 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" />
      </label>
      <div role="group" aria-label="Show" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map(([f, label]) => <button key={f} type="button" className="duo-chip" aria-pressed={filter === f} onClick={() => setParam("show", f === "behind" ? null : f)}>{label}</button>)}
      </div>
      <Button variant="ghost" style={{ minHeight: 44, fontSize: 14 }} onClick={() => exportCsv(shown, data.month)}><Download size={18} aria-hidden="true" />Export CSV</Button>
    </div>
  );

  return (
    <>
      <div className="duo-page duo-screen-in" data-rail={selected ? undefined : "none"} style={selected ? undefined : { maxWidth: 986 }}>
        <div className="duo-page-head">
          <AdminHeader title="People & office days" subtitle={`${data.total} people · ${data.admins} admin${data.admins === 1 ? "" : "s"} · ${monthName(data.month)} target 8 days`}
            actions={<Button variant="ghost" onClick={() => setFix({})}>Fix someone’s day</Button>} />
        </div>
        <div className="duo-page-main">
          <div className="duo-sm-only" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <StatTile label="On track" value={data.status.onTrack + data.status.done} sub="incl. done" tone="sky" />
            <StatTile label="Behind" value={data.status.behind} sub="under pace" tone="pink" />
            <StatTile label="Exempt" value={data.status.exempt} sub="no target" tone="soft" />
          </div>
          {tools}
          {/* Laptop: the table. */}
          <Card className="duo-lg-only" style={{ padding: 6, flexDirection: "column" }}>
            <div className="duo-table-wrap"><table className="duo-table" data-dense={selected ? "true" : undefined}>
              <thead><tr>{["Person", "Role", "Office days", "Today", "This month", "Status", ""].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.email} aria-selected={p.email === selectedEmail} onClick={() => pick(p)}>
                    <td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ borderRadius: 999, background: toneBg(STATUS[p.status][1]) }}><Avatar name={p.name} size={selected ? 28 : 32} /></span><span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{p.name}</span></span></td>
                    <td>{p.role === "admin" ? "Admin" : "Member"}</td>
                    <td>{p.schedule}</td>
                    <td>{p.today ? TODAY_LABEL[p.today] : "—"}</td>
                    <td><Bars8 done={p.done} target={p.target} /></td>
                    <td><StatusPill status={p.status} /></td>
                    <td><button type="button" aria-label={`Actions for ${p.name}`} onClick={(e) => { e.stopPropagation(); pick(p); }} style={{ cursor: "pointer", width: 34, height: 34, borderRadius: 10, border: "none", background: "transparent", color: "var(--duo-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><MoreHorizontal size={18} aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <span className="duo-sub" style={{ fontSize: 12, padding: "10px 12px 2px" }}>Showing {shown.length} of {data.total}{filter === "behind" ? " · behind first" : ""}</span>
          </Card>
          {/* Phone and tablet: a list; tapping a person opens their month in a sheet. */}
          <div className="duo-sm-only" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.map((p) => (
              <button key={p.email} type="button" className="duo-row" onClick={() => pick(p)} aria-label={`${p.name}, ${p.schedule}, ${p.target === null ? "exempt" : `${p.done} of ${p.target}`}, ${STATUS[p.status][0]}`}>
                <span style={{ borderRadius: 999, background: toneBg(STATUS[p.status][1]) }}><Avatar name={p.name} size={36} /></span>
                <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>{p.name}</span>
                  <span className="duo-sub" style={{ fontSize: 12 }}>{p.schedule}</span>
                </span>
                {p.target !== null && <span style={{ fontFamily: "var(--duo-display)", fontWeight: 700 }}>{p.done}/{p.target}</span>}
                <StatusPill status={p.status} />
              </button>
            ))}
            <span className="duo-sub" style={{ fontSize: 13 }}>Tap a person to see their month, mark them exempt, or fix a day.</span>
          </div>
        </div>
        {selected && <aside className="duo-page-rail duo-lg-only" style={{ flexDirection: "column" }}><Card style={{ padding: 14 }}><PersonPanel person={selected} month={data.month} onFix={() => setFix({ email: selected.email })} /></Card></aside>}
      </div>
      {selected && !wide && !fix && <Sheet label={selected.name} onClose={() => setParam("person", null)}><PersonPanel person={selected} month={data.month} onFix={() => setFix({ email: selected.email })} /></Sheet>}
      {fix && <FixDaySheet people={data.people} start={fix} onClose={() => setFix(null)} />}
    </>
  );
}
