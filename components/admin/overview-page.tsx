"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, ChevronRight, Coffee, Copy, Cookie, MessageSquare, Plus, Users, Wifi, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Flat, QueryState, Tile } from "@/components/duo";
import { useAdminOverview, useAllGrievances, useSend, useSnacks, type AdminData, type Snacks } from "@/lib/queries";
import { Bars8, FixDaySheet, STATUS, StatTile, StatusPill, TODAY_LABEL, exportCsv, fmtDay, monthName, toneBg, useAdminRefresh } from "./admin-ui";

const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0);
const ICON: Record<AdminData["needsYou"][number]["kind"], LucideIcon> = { speak: MessageSquare, snack: Cookie, wifi: Wifi };

function NeedsYou({ items }: { items: AdminData["needsYou"] }) {
  const add = useSend<{ id: string; action: "add" }, Snacks>(["snacks"], "/api/snacks", "PATCH", { replace: true });
  const refresh = useAdminRefresh();
  return (
    <section aria-label="Needs you" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 className="duo-h2" style={{ display: "flex", alignItems: "center", gap: 8 }}>Needs you <span className="duo-pill duo-tone-pink">{items.length}</span></h2>
      {items.length === 0 && <Flat><span className="duo-sub">Nothing waiting. Lappy approves.</span></Flat>}
      {items.map((n) => {
        const Icon = ICON[n.kind];
        return (
          <Card key={n.id} style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, ...(n.urgent ? { borderColor: "var(--duo-pink-edge)", background: "var(--duo-pink)" } : {}) }}>
            <Tile tone={n.kind === "speak" ? "pink" : n.kind === "snack" ? "gold" : "sky"}><Icon size={20} /></Tile>
            <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{n.title}</span>
              <span className="duo-sub" style={{ fontSize: 12 }}>{n.sub}</span>
            </span>
            {n.kind === "snack" ? (
              <Button style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }} disabled={add.isPending}
                onClick={() => add.mutate({ id: n.id.replace(/^snack-/, ""), action: "add" }, { onSuccess: () => { toast.success("On the shelf"); refresh(); }, onError: (e) => toast.error(e.message) })}><Plus size={16} aria-hidden="true" />Add</Button>
            ) : (
              <Link href={n.href} className="duo-btn duo-btn-g" style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }}>{n.kind === "speak" ? "Open" : "View"}</Link>
            )}
          </Card>
        );
      })}
    </section>
  );
}

function ChaiRound({ tea }: { tea: AdminData["tea"] }) {
  const copy = () => navigator.clipboard.writeText(tea.names.join(", ")).then(() => toast.success("Names copied"), () => toast.error("Couldn't copy. Select the names instead."));
  return (
    <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "var(--duo-gold-soft)", borderColor: "var(--duo-gold-edge)", color: "var(--duo-gold-text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Coffee size={20} aria-hidden="true" />
        <span style={{ flexGrow: 1, fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>Chai round · {tea.count} cup{tea.count === 1 ? "" : "s"}</span>
        {tea.count > 0 && <Button variant="ghost" style={{ minHeight: 40, fontSize: 14 }} onClick={copy}><Copy size={16} aria-hidden="true" />Copy list</Button>}
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.5 }}>{tea.count ? tea.names.join(" · ") : "Nobody's in yet. The round closes at 3:30."}</span>
    </Card>
  );
}

function ToOrder({ snacks }: { snacks?: Snacks }) {
  const list = (snacks?.shelf ?? []).filter((s) => s.votes > 0).slice(0, 5);
  const max = Math.max(1, ...list.map((s) => s.votes));
  return (
    <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ flexGrow: 1, fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>Snacks to order</span>
        <Link href="/admin/snacks" className="duo-btn duo-btn-text" style={{ minHeight: 32 }}>Open shelf<ChevronRight size={16} aria-hidden="true" /></Link>
      </div>
      {list.length === 0 && <span className="duo-sub" style={{ fontSize: 13 }}>No votes on the shelf yet.</span>}
      {list.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 120, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
          <span style={{ flexGrow: 1, height: 10, borderRadius: 5, background: "var(--duo-soft)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(100 * s.votes) / max}%`, background: "var(--duo-primary)", borderRadius: 5 }} /></span>
          <span style={{ width: 22, textAlign: "right", fontFamily: "var(--duo-display)", fontWeight: 700 }}>{s.votes}</span>
        </div>
      ))}
    </Card>
  );
}

function ManageTile({ href, Icon, title, sub, badge }: { href: string; Icon: LucideIcon; title: string; sub: string; badge?: number }) {
  return (
    <Link href={href} className="duo-btn duo-btn-g duo-tilebtn" style={{ position: "relative", minHeight: 96 }}>
      <Icon size={22} aria-hidden="true" />
      <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
      <span className="duo-sub" style={{ fontSize: 12 }}>{sub}</span>
      {!!badge && <span className="duo-badge" aria-label={`${badge} open`}>{badge}</span>}
    </Link>
  );
}

// Phone and tablet: the hub (D-AdminPhone, screen 2).
function Hub({ data, openReports, toOrder }: { data: AdminData; openReports: number; toOrder: number }) {
  const poorToday = data.needsYou.find((n) => n.kind === "wifi");
  return (
    <div className="duo-col duo-screen-in duo-sm-only" style={{ flexDirection: "column" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 className="duo-h1">Admin</h1>
        <span className="duo-sub">{fmtDay(data.today)} · you’re an admin</span>
      </header>
      <NeedsYou items={data.needsYou} />
      <h2 className="duo-h2">Manage</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <ManageTile href="/admin/today" Icon={CalendarCheck} title="Today" sub={`${data.counts.office} in · ${data.tea.count} chai`} />
        <ManageTile href="/admin/people" Icon={Users} title="Office days" sub={`${data.status.behind} behind target`} />
        <ManageTile href="/admin/people?show=all" Icon={Users} title="People" sub={`${data.total} · ${data.admins} admin${data.admins === 1 ? "" : "s"}`} />
        <ManageTile href="/admin/speak-up" Icon={MessageSquare} title="Speak up inbox" sub={`${openReports} open`} badge={openReports} />
        <ManageTile href="/admin/snacks" Icon={Cookie} title="Snack shelf" sub={`${toOrder} to order`} />
        <ManageTile href="/admin/wifi" Icon={Wifi} title="Wi-Fi reports" sub={poorToday ? poorToday.title.replace(" reports today", "").replace(" report today", "") + " today" : "No poor reports today"} />
      </div>
      <OldTools />
    </div>
  );
}

// Announcements, events, roles, joining dates and leave snapshots still live on the old screen
// until the canvas draws them a new home (canvas-map.md, "Not drawn").
function OldTools() {
  return (
    <Link href="/admin/tools" className="duo-btn duo-btn-g duo-peek">
      <Tile tone="soft"><Wrench size={20} /></Tile>
      <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>More admin tools</span>
        <span className="duo-sub" style={{ fontSize: 12 }}>Announcements, events, joining dates, leave balances</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

// Laptop: the dashboard (D-AdminDesktop).
function Dashboard({ data, snacks }: { data: AdminData; snacks?: Snacks }) {
  const [fix, setFix] = useState(false);
  const router = useRouter();
  const top = data.people.slice(0, 8);
  const s = data.status;
  const seg = [["on track", s.onTrack, "var(--duo-primary)"], ["behind", s.behind, "var(--duo-pink-edge)"], ["done", s.done, "var(--duo-seg-on)"], ["exempt", s.exempt, "var(--duo-line)"]] as const;
  const asOf = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date());
  return (
    <div className="duo-lg-only duo-screen-in" style={{ width: "100%", maxWidth: 1040, flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 className="duo-h1">Admin overview</h1>
          <span className="duo-sub">{fmtDay(data.today)} · the office today, and this month so far</span>
        </div>
        <Button variant="ghost" onClick={() => setFix(true)}>Fix someone’s day</Button>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <StatTile label="In office" value={data.counts.office} sub={`${pct(data.counts.office, data.total)}% of ${data.total}`} tone="green" />
        <StatTile label="On leave" value={data.counts.leave} sub="today" tone="gold" />
        <StatTile label="Not in office" value={data.counts.notIn} sub={`as of ${asOf}`} tone="soft" />
        <StatTile label="Chai cups" value={data.tea.count} sub="round at 4 PM" tone="grape" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16, alignItems: "start" }}>
        <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
              <span className="duo-h2">Office days · {monthName(data.month)}</span>
              <span className="duo-sub" style={{ fontSize: 13 }}>Target 8 days · {data.workingLeft} working day{data.workingLeft === 1 ? "" : "s"} left this month</span>
            </span>
            <Link href="/admin/people" className="duo-btn duo-btn-g" style={{ minHeight: 42, fontSize: 14 }}>Search people</Link>
            <Button variant="ghost" style={{ minHeight: 42, fontSize: 14 }} onClick={() => exportCsv(data.people, data.month)}>Export CSV</Button>
          </div>
          <div aria-hidden="true" style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "var(--duo-soft)" }}>
            {seg.map(([label, n, color]) => n > 0 && <span key={label} style={{ width: `${pct(n, data.total)}%`, background: color }} />)}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {seg.map(([label, n, color]) => <span key={label} className="duo-sub" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: color }} /><b style={{ color: "var(--duo-ink)" }}>{n}</b> {label}</span>)}
          </div>
          <table className="duo-table">
            <thead><tr>{["Person", "Office days", "Today", "This month", "Status"].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.email} onClick={() => router.push(`/admin/people?person=${encodeURIComponent(p.email)}`)}>
                  <td><Link href={`/admin/people?person=${encodeURIComponent(p.email)}`} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ borderRadius: 999, background: toneBg(STATUS[p.status][1]) }}><Avatar name={p.name} size={30} /></span><span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{p.name}</span></Link></td>
                  <td>{p.schedule}</td>
                  <td>{p.today ? TODAY_LABEL[p.today] : "—"}</td>
                  <td><Bars8 done={p.done} target={p.target} /></td>
                  <td><StatusPill status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="duo-sub" style={{ fontSize: 12, flexGrow: 1 }}>Showing {top.length} of {data.total} · behind first</span>
            <Link href="/admin/people?show=all" className="duo-btn duo-btn-text" style={{ minHeight: 32 }}>See all {data.total}<ChevronRight size={16} aria-hidden="true" /></Link>
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <NeedsYou items={data.needsYou} />
          <ChaiRound tea={data.tea} />
          <ToOrder snacks={snacks} />
          <OldTools />
        </div>
      </div>
      {fix && <FixDaySheet people={data.people} onClose={() => setFix(false)} />}
    </div>
  );
}

export function OverviewPage() {
  const overview = useAdminOverview();
  const snacks = useSnacks();
  const grievances = useAllGrievances();
  if (!overview.data) return <div className="duo-col"><h1 className="duo-h1">Admin</h1><QueryState error={overview.error} onRetry={() => overview.refetch()} what="the admin overview" /></div>;
  const openReports = (grievances.data ?? []).filter((g) => g.status === "open").length;
  const toOrder = (snacks.data?.shelf ?? []).filter((s) => s.votes > 0).length;
  return (
    <>
      <Hub data={overview.data} openReports={openReports} toOrder={toOrder} />
      <Dashboard data={overview.data} snacks={snacks.data} />
    </>
  );
}

export { ChaiRound };
