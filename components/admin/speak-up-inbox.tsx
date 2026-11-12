"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, Flat, Pill, QueryState, type Tone } from "@/components/duo";
import { Lappy } from "@/components/duo/lappy";
import { Sheet } from "@/components/duo/sheet";
import { relativeTime } from "@/lib/format";
import { useAllGrievances, useSend, type Grievance } from "@/lib/queries";
import { AdminHeader, useAdminRefresh, useWide } from "./admin-ui";

type Status = Grievance["status"];
const STATUS: [Status, string, Tone][] = [["open", "Open", "pink"], ["in_progress", "In progress", "gold"], ["resolved", "Resolved", "green"]];
const label = (s: Status) => STATUS.find(([k]) => k === s)!;

function Detail({ g }: { g: Grievance }) {
  const refresh = useAdminRefresh();
  const set = useSend<{ id: string; status: Status }>(["admin", "grievances"], "/api/grievances", "PATCH");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>{g.urgent && <Pill tone="pink">Urgent</Pill>}<Pill tone={label(g.status)[2]}>{label(g.status)[1]}</Pill></div>
      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{g.body}</span>
      {g.image && <img src={g.image} alt="Photo attached to the report" style={{ width: "100%", borderRadius: 14 }} />}
      <Flat style={{ padding: 12 }}>
        <span className="duo-sub" style={{ fontSize: 12 }}>{g.displayName ? `Sent by ${g.displayName}, ${relativeTime(g.createdAt).toLowerCase()}.` : "Anonymous. No name, email or device is stored, so you can’t reply directly. The sender sees the status on their own device."}</span>
      </Flat>
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>Set status</span>
      <div role="group" aria-label="Set status" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {STATUS.map(([k, l, tone]) => (
          <button key={k} type="button" aria-pressed={g.status === k} disabled={set.isPending} className={`duo-btn ${g.status === k ? `duo-tone-${tone} duo-tonebtn` : "duo-btn-g"}`}
            style={{ minHeight: 44, fontSize: 14, padding: "0 8px", ...(g.status === k ? { borderColor: `var(--duo-${tone}-edge)`, boxShadow: `0 4px 0 var(--duo-${tone}-edge)` } : {}) }}
            onClick={() => set.mutate({ id: g.id, status: k }, { onSuccess: () => { toast.success(`Marked ${l.toLowerCase()}`); refresh(); }, onError: (e) => toast.error(e.message) })}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// D-AdminDesk-SpeakUp. Not drawn for the phone; there the selected report opens in a sheet.
export function SpeakUpInbox() {
  const list = useAllGrievances();
  const params = useSearchParams();
  const router = useRouter();
  const wide = useWide();
  const tab: Status = (STATUS.find(([k]) => k === params.get("status"))?.[0]) ?? "open";
  const go = (status: Status, id?: string) => router.replace(`/admin/speak-up?status=${status}${id ? `&id=${id}` : ""}`, { scroll: false });
  const all = list.data ?? [];
  const shown = all.filter((g) => g.status === tab).sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt));
  const selected = all.find((g) => g.id === params.get("id")) ?? (wide ? shown[0] : undefined);
  const open = all.filter((g) => g.status === "open").length;
  const head = <AdminHeader title="Speak up inbox" subtitle={list.data ? `${open} open · urgent first` : "Loading…"} />;
  if (!list.data) return <div className="duo-col">{head}<QueryState error={list.error} onRetry={() => list.refetch()} what="the inbox" /></div>;
  return (
    <div className="duo-page duo-screen-in" data-rail={wide && selected ? undefined : "none"}>
      <div className="duo-page-head">{head}</div>
      <div className="duo-page-main">
        <div role="group" aria-label="Status" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS.map(([k, l]) => <button key={k} type="button" className="duo-chip" aria-pressed={tab === k} onClick={() => go(k)}>{l}<span className="duo-chip-count">{all.filter((g) => g.status === k).length}</span></button>)}
        </div>
        {shown.length === 0 && (
          <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <Lappy pose="idle" width={100} decorative />
            <span className="duo-sub">{tab === "open" ? "Nothing open. All quiet." : "Nothing here."}</span>
          </Card>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((g) => {
            const on = selected?.id === g.id;
            return (
              <button key={g.id} type="button" aria-pressed={on} onClick={() => go(tab, g.id)} className="duo-row" style={{ padding: 14, ...(on ? { background: "var(--duo-sky)", borderColor: "var(--duo-primary)", boxShadow: "0 4px 0 var(--duo-primary-edge)" } : {}) }}>
                <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{g.body}</span>
                  <span className="duo-sub" style={{ fontSize: 12 }}>{g.displayName ?? "Anonymous"} · {relativeTime(g.createdAt).toLowerCase()}</span>
                </span>
                {g.urgent && <Pill tone="pink">Urgent</Pill>}
                <Pill tone={label(g.status)[2]}>{label(g.status)[1]}</Pill>
              </button>
            );
          })}
        </div>
      </div>
      {wide && selected && <aside className="duo-page-rail"><Card style={{ padding: 14 }}><Detail g={selected} /></Card></aside>}
      {!wide && selected && <Sheet label="Report" onClose={() => go(tab)}><Detail g={selected} /><Button variant="ghost" onClick={() => go(tab)}>Close</Button></Sheet>}
    </div>
  );
}
