"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Flag } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Flat, PageHeader, QueryState, Split } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Celebrate } from "@/components/duo/celebrate";
import { Lappy } from "@/components/duo/lappy";
import type { LeagueRow } from "@/lib/member-features";
import { useSend, useSteps, type Steps } from "@/lib/queries";

const n = (v: number) => v.toLocaleString("en-IN");
const GOAL = 10_000;

function Ring({ steps }: { steps: number }) {
  const c = 2 * Math.PI * 62;
  const done = Math.min(1, steps / GOAL) * c;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={`${n(steps)} of 10,000 steps today`}>
      <circle cx="75" cy="75" r="62" fill="none" stroke="var(--duo-soft)" strokeWidth="16" />
      {steps > 0 && <circle cx="75" cy="75" r="62" fill="none" stroke="var(--duo-seg-on)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${done} ${c}`} transform="rotate(-90 75 75)" style={{ transition: "stroke-dasharray .6s" }} />}
      <text x="75" y="72" textAnchor="middle" fontFamily="var(--duo-display)" fontSize="28" fontWeight="700" fill="var(--duo-ink)">{n(steps)}</text>
      <text x="75" y="94" textAnchor="middle" fontFamily="var(--duo-body)" fontSize="13" fontWeight="800" fill="var(--duo-muted)">of 10,000</text>
    </svg>
  );
}

function Podium({ rows }: { rows: LeagueRow[] }) {
  // Second, first, third — the classic podium order.
  const order = [rows[1], rows[0], rows[2]];
  const height = [64, 92, 48];
  return (
    <ol aria-label="Top three" style={{ listStyle: "none", margin: 0, display: "flex", alignItems: "flex-end", gap: 12, padding: "8px clamp(0px, 6vw, 40px) 0" }}>
      {order.map((r, i) => {
        const rank = [2, 1, 3][i];
        if (!r) return <li key={rank} style={{ flex: "1 1 0" }} aria-hidden="true" />;
        return (
          <li key={r.email} style={{ flex: "1 1 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }} aria-label={`${rank}. ${r.name}${r.me ? " (you)" : ""}, ${n(r.steps)} steps`}>
            {rank === 1 && <Crown size={20} color="var(--duo-gold)" fill="var(--duo-gold)" aria-hidden="true" />}
            <span style={{ borderRadius: 999, background: "#fff" }}><Avatar name={r.name} size={rank === 1 ? 52 : 44} /></span>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.me ? "You" : r.name}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--duo-hero-muted)" }}>{n(r.steps)}</span>
            <div aria-hidden="true" style={{ width: "100%", height: height[i], borderRadius: "14px 14px 0 0", background: rank === 1 ? "var(--duo-gold)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--duo-display)", fontSize: 22, fontWeight: 700, color: "var(--duo-hero)" }}>{rank}</div>
          </li>
        );
      })}
    </ol>
  );
}

function League({ league }: { league: NonNullable<Steps["league"]> }) {
  const [tab, setTab] = useState<"week" | "today">("week");
  const rows = league[tab];
  const nudge = league.nudge[tab];
  return (
    <>
      <section aria-label="Step league" style={{ background: "var(--duo-hero)", color: "#fff", borderRadius: 24, padding: rows.length ? "18px 18px 0" : 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 22, fontWeight: 700 }}>Step league</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--duo-hero-muted)" }}>{tab === "week" ? "This week · resets Monday" : "Today so far"}</span>
          </span>
          <div role="group" aria-label="League period" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "rgba(255,255,255,.16)", width: 200 }}>
            {(["week", "today"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}
                style={{ cursor: "pointer", flex: "1 1 0", height: 36, border: "none", borderRadius: 10, background: tab === t ? "#fff" : "transparent", color: tab === t ? "var(--duo-hero)" : "#fff", fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{t === "week" ? "Week" : "Today"}</button>
            ))}
          </div>
        </div>
        {rows.length ? <Podium rows={rows} /> : <span style={{ fontSize: 14, fontWeight: 700, color: "var(--duo-hero-muted)" }}>Nobody has logged steps {tab === "week" ? "this week" : "today"} yet. Log yours to take the top spot.</span>}
      </section>
      {nudge && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--duo-gold-soft)", color: "var(--duo-gold-text)", borderRadius: 14, padding: "10px 14px", fontSize: 14, fontWeight: 800 }}>
          <Flag size={18} aria-hidden="true" />Pass {nudge.name} with {n(nudge.steps)} more steps
        </div>
      )}
      {rows.length > 3 && (
        <Card style={{ padding: 10 }}>
          <ol start={4} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {rows.slice(3).map((r, i) => (
              <li key={r.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 14, background: r.me ? "var(--duo-sky)" : "transparent" }}>
                <span style={{ width: 22, fontFamily: "var(--duo-display)", fontWeight: 700, color: "var(--duo-muted)" }}>{i + 4}</span>
                <Avatar name={r.name} size={34} />
                <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{r.name}{r.me ? " (you)" : ""}</span>
                  {r.streak > 1 && <span className="duo-sub" style={{ fontSize: 12 }}>{r.streak}-day streak</span>}
                </span>
                <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 700 }}>{n(r.steps)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}

function LogToday({ data, onTenK }: { data: Steps; onTenK: () => void }) {
  const today = data.league?.me.todaySteps ?? data.me?.today?.steps ?? 0;
  const [draft, setDraft] = useState(today ? String(today) : "");
  const log = useSend<{ steps: number }, { hit: boolean; steps: number }>(["steps"], "/api/steps", "POST");
  const left = Math.max(0, GOAL - today);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const steps = Number(draft.replace(/[,\s]/g, ""));
    if (!Number.isInteger(steps) || steps < 0) return toast.error("Type your steps as a whole number");
    const wasHit = today >= GOAL;
    log.mutate({ steps }, { onSuccess: (r) => { if (r.hit && !wasHit) onTenK(); else toast.success("Steps logged"); }, onError: (err) => toast.error(err.message) });
  };
  return (
    <>
      <Card>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>Today</span>
          <div style={{ display: "flex", justifyContent: "center" }}><Ring steps={today} /></div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="duo-label">Today’s steps</span>
            <input className="duo-input" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="7400" />
          </label>
          <Button type="submit" disabled={log.isPending || !draft.trim()} style={{ width: "100%", minHeight: 50 }}>Log steps</Button>
          <span className="duo-sub" style={{ fontSize: 12 }}>Type the number from your phone or watch. You can update it any time today.</span>
        </form>
      </Card>
      <Flat style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
        <div style={{ flexShrink: 0 }}><Lappy pose="run" width={84} decorative /></div>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>{left ? `${n(left)} to go` : "10K done today!"}</span>
          <span className="duo-sub" style={{ fontSize: 12 }}>{left ? "Hit 10,000 and Lappy does a lap." : data.league?.me.streak ? `${data.league.me.streak}-day streak. Keep it going tomorrow.` : "Lappy is proud of you."}</span>
        </span>
      </Flat>
    </>
  );
}

export function StepsPage() {
  const steps = useSteps();
  const router = useRouter();
  const [party, setParty] = useState(false);
  const head = <PageHeader title="10K steps" subtitle="Log today, climb the league" actions={<BellLink />} back={{ href: "/", label: "Back to home" }} />;
  if (!steps.data) return <Split head={head}><QueryState error={steps.error} onRetry={() => steps.refetch()} what="the step league" /></Split>;
  return (
    <>
      <Split head={head} railFirst="phone" rail={<LogToday key={steps.data.league?.me.todaySteps ?? 0} data={steps.data} onTenK={() => setParty(true)} />}>
        {steps.data.league && <League league={steps.data.league} />}
      </Split>
      {party && <Celebrate pose="run" title="10K UNLOCKED!" sub="Ten thousand steps today. Lappy did a lap in your honour." onDone={() => setParty(false)}
        onBrag={() => router.push(`/feed?new=quote&text=${encodeURIComponent("Just hit 10,000 steps today! 🏃")}`)} />}
    </>
  );
}
