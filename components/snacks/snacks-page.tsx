"use client";
import Link from "next/link";
import { useState } from "react";
import { Cookie, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Button, QueryState, StatusChip } from "@/components/m3";
import { PageHero } from "@/components/m3/hero";
import { useDays, useSnacks, useSnackWrite, useTea, type SnackRow, type Snacks } from "@/lib/queries";
import { clock, TeaCard } from "./tea";

// Tea & snacks from the Material 3 prototype. Tea and today's snack are for people checked in at
// the office; suggestions are for everyone. Everything here is anonymous except tea.

function Gate() {
  return (
    <section aria-labelledby="gate-h" className="pg-card" style={{ gap: 10 }}>
      <h2 id="gate-h" className="m3-title" style={{ fontSize: 18 }}>Tea &amp; snacks are for people in the office today</h2>
      <p className="m3-body" style={{ margin: 0 }}>Check in on Home to book tea and pick a snack.</p>
      <Link href="/" className="m3-btn m3-btn-filled" style={{ alignSelf: "flex-end", height: 44, padding: "0 24px" }}>Check in</Link>
    </section>
  );
}

function TodaysSnacks({ snacks }: { snacks: Snacks }) {
  const pick = useSnackWrite<{ id: string; action: "pick" | "unpick" }>("PATCH");
  const { today } = snacks;
  const choose = (id: string, mine: boolean) => pick.mutate({ id, action: mine ? "unpick" : "pick" }, { onError: (e) => toast.error(e.message) });
  return (
    <section aria-labelledby="today-h" className="pg-card" style={{ gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 id="today-h" className="m3-title">Today&apos;s snacks</h2>
        <StatusChip tone={today.open ? "warn" : "success"}>{today.open ? `Order goes in at ${clock(today.orderAt)}` : "Order placed"}</StatusChip>
      </div>
      <p className="m3-small" style={{ margin: 0 }}>{today.open ? `Pick one for today. You can switch until the order goes in at ${clock(today.orderAt)}. Nobody sees who picked what.` : "Today's order is in. Picks open again tomorrow."}</p>
      {snacks.shelf.length === 0 && <p className="m3-small" style={{ margin: 0 }}>Nothing on today&apos;s list yet.</p>}
      <div className="sn-grid">
      {snacks.shelf.map((s) => {
        const mine = today.mine === s.id;
        return (
          <div key={s.id} className="sn-tile" data-mine={mine || undefined}>
            <span aria-hidden="true" className="sn-icon"><Cookie size={22} /></span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{s.name}</span>
            {today.open ? (
              <button type="button" aria-pressed={mine} disabled={pick.isPending} onClick={() => choose(s.id, mine)} className={`m3-btn ${mine ? "m3-btn-filled" : "m3-btn-outlined"}`} style={{ height: 36, padding: "0 14px", fontSize: 13, flex: "none" }}>
                {mine ? "Your pick" : today.mine ? "Switch to this" : "Pick this"}
              </button>
            ) : mine ? <span className="m3-small" style={{ fontWeight: 700 }}>Your pick</span> : null}
          </div>
        );
      })}
      </div>
    </section>
  );
}

function Suggestions({ list }: { list: SnackRow[] }) {
  const vote = useSnackWrite<{ id: string; action: "vote" }>("PATCH");
  const add = useSnackWrite<{ name: string }>("POST");
  const [name, setName] = useState("");
  return (
    <section aria-labelledby="ideas-h" className="pg-card" style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, borderRadius: 20, background: "#FFF1C2", color: "#5C4300", display: "grid", placeItems: "center" }}><Lightbulb size={20} /></span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <h2 id="ideas-h" className="m3-title">Suggestions for coming days</h2>
          <span className="m3-small">Anonymous. Popular ones get added to a future day&apos;s options.</span>
        </span>
      </div>
      {list.length === 0 && <p className="m3-small" style={{ margin: 0 }}>No suggestions yet.</p>}
      {list.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44 }}>
          <span style={{ flex: 1 }}>{s.name}</span>
          <button type="button" aria-pressed={s.mine} aria-label={`Plus one ${s.name}`} disabled={vote.isPending} onClick={() => vote.mutate({ id: s.id, action: "vote" }, { onError: (e) => toast.error(e.message) })}
            style={{ height: 36, minWidth: 52, padding: "0 12px", borderRadius: 18, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: s.mine ? 0 : "1px solid var(--m3-outline)", background: s.mine ? "var(--m3-secondary-container)" : "transparent", color: s.mine ? "var(--m3-on-secondary-container)" : "var(--m3-primary)" }}>+{s.votes}</button>
        </div>
      ))}
      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; add.mutate({ name }, { onSuccess: () => { setName(""); toast.success("Suggested. Nobody can see it was you."); }, onError: (err) => toast.error(err.message) }); }}>
        <label className="sr-only" htmlFor="suggest">Suggest a snack</label>
        <input id="suggest" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Suggest a snack"
          style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, border: "1px solid var(--m3-outline)", padding: "0 12px", fontFamily: "inherit", fontSize: 15, background: "var(--m3-surface)" }} />
        <Button type="submit" variant="outlined" disabled={add.isPending || !name.trim()} style={{ height: 44, flex: "none" }}>Add</Button>
      </form>
    </section>
  );
}

export function SnacksPage() {
  const days = useDays();
  const tea = useTea();
  const snacks = useSnacks();
  const inOffice = days.data?.me?.mode === "office";
  const ready = days.data && snacks.data;
  return (
    <div className="m3 m3-page pg-wide m3-stack">
      <PageHero page="snacks" title="Tea & snacks" subtitle={inOffice ? "Answer the tea round and pick today's snack" : "For people in the office today. Everything here is anonymous except tea."} />
      {!ready ? <QueryState error={days.error ?? snacks.error} onRetry={() => { days.refetch(); snacks.refetch(); }} what="tea & snacks" /> : (
        <div className="pg-cols">
          <div className="pg-main">
            {!inOffice && <Gate />}
            {inOffice && tea.data && <TeaCard tea={tea.data} />}
            {inOffice && <TodaysSnacks snacks={snacks.data} />}
          </div>
          <aside className="pg-rail">
            <Suggestions list={snacks.data.suggestions} />
          </aside>
        </div>
      )}
    </div>
  );
}
