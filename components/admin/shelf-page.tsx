"use client";
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, QueryState } from "@/components/duo";
import { Sheet } from "@/components/duo/sheet";
import { useSend, useSnacks, type Snacks } from "@/lib/queries";
import { AdminHeader, useAdminRefresh } from "./admin-ui";
import { SnackTimesCard, TodayCard } from "./snack-times";

type Action = { id: string; action: "add" | "dismiss" | "ordered" | "remove" };

function AddSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const add = useSend<{ name: string; shelf: true }, Snacks>(["snacks"], "/api/snacks", "POST", { replace: true });
  return (
    <Sheet label="Add an item" onClose={onClose}>
      <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); add.mutate({ name, shelf: true }, { onSuccess: () => { toast.success("On the shelf"); onClose(); }, onError: (err) => toast.error(err.message) }); }}>
        <h2 className="duo-h2" style={{ fontSize: 22 }}>Add an item yourself</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Snack</span><input className="duo-input" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Murukku" /></label>
        <Button type="submit" disabled={add.isPending || !name.trim()}>Put it on the shelf</Button>
      </form>
    </Sheet>
  );
}

// D-AdminDesk-Shelf and D-AdminPhone screen 5.
export function ShelfPage() {
  const snacks = useSnacks();
  const refresh = useAdminRefresh();
  const act = useSend<Action, Snacks>(["snacks"], "/api/snacks", "PATCH", { replace: true });
  const [adding, setAdding] = useState(false);
  const run = (a: Action, ok: string) => act.mutate(a, { onSuccess: () => { toast.success(ok); refresh(); }, onError: (e) => toast.error(e.message) });
  const head = <AdminHeader title="Snacks & tea" subtitle="Times, today’s numbers, and what to buy next · picks are anonymous" />;
  if (!snacks.data) return <div className="duo-col">{head}<QueryState error={snacks.error} onRetry={() => snacks.refetch()} what="the snack shelf" /></div>;
  const shelf = snacks.data.shelf;
  const max = Math.max(1, ...shelf.map((s) => s.votes));

  const suggestions = (
    <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>Suggestions from the team</span>
      <span className="duo-sub" style={{ fontSize: 12 }}>Add puts it on the shelf for everyone to vote on.</span>
      {snacks.data.suggestions.length === 0 && <span className="duo-sub" style={{ fontSize: 13 }}>No suggestions right now.</span>}
      {snacks.data.suggestions.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>{s.name}</span>
            <span className="duo-sub" style={{ fontSize: 12 }}>{s.votes} vote{s.votes === 1 ? "" : "s"} · anonymous</span>
          </span>
          <Button disabled={act.isPending} style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }} onClick={() => run({ id: s.id, action: "add" }, `${s.name} is on the shelf`)}><Plus size={16} aria-hidden="true" />Add</Button>
          <button type="button" aria-label={`Dismiss ${s.name}`} disabled={act.isPending} className="duo-btn duo-btn-g duo-btn-icon" style={{ width: 40, minHeight: 40, borderRadius: 12 }} onClick={() => run({ id: s.id, action: "dismiss" }, `${s.name} dismissed`)}><X size={16} aria-hidden="true" /></button>
        </div>
      ))}
    </Card>
  );

  return (
    <>
      <div className="duo-page duo-screen-in">
        <div className="duo-page-head">{head}</div>
        <div className="duo-page-main">
          <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <h2 className="duo-h2" style={{ flexGrow: 1 }}>To order</h2>
              <span className="duo-sub" style={{ fontSize: 12 }}>sorted by interest · all votes anonymous</span>
            </div>
            {shelf.length === 0 && <span className="duo-sub" style={{ fontSize: 13, padding: "8px 0" }}>The shelf is empty. Add a suggestion or an item yourself.</span>}
            {shelf.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "2px solid var(--duo-line)", flexWrap: "wrap" }}>
                <span style={{ width: 48, height: 48, borderRadius: 16, background: "var(--duo-sky)", color: "var(--duo-brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "var(--duo-display)", fontSize: 22, fontWeight: 700 }} aria-label={`${s.votes} votes`}>{s.votes}</span>
                <span style={{ flex: "1 1 140px", display: "flex", flexDirection: "column" }}>
                  <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>{s.name}</span>
                  <span className="duo-sub" style={{ fontSize: 12 }}>{s.votes ? `${s.votes} ${s.votes === 1 ? "person" : "people"} would like this` : s.orderedAt ? "Ordered, votes start again" : "No votes yet"}</span>
                </span>
                <span className="duo-wide-only" aria-hidden="true" style={{ width: 120, height: 10, borderRadius: 5, background: "var(--duo-soft)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(100 * s.votes) / max}%`, background: "var(--duo-primary)", borderRadius: 5 }} /></span>
                <Button variant="ghost" disabled={act.isPending} style={{ minHeight: 44, fontSize: 14 }} onClick={() => run({ id: s.id, action: "ordered" }, `${s.name} marked ordered`)}><Check size={16} aria-hidden="true" />Mark ordered</Button>
              </div>
            ))}
          </Card>
          <Button variant="ghost" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" />Add an item yourself</Button>
        </div>
        <aside className="duo-page-rail" style={{ display: "flex", flexDirection: "column", gap: 14 }}><TodayCard /><SnackTimesCard />{suggestions}</aside>
      </div>
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </>
  );
}
