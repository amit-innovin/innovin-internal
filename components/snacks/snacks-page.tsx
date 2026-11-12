"use client";
import { useState } from "react";
import { Coffee, Heart } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Flat, PageHeader, QueryState, Split } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Lappy } from "@/components/duo/lappy";
import { relativeDay } from "@/lib/format";
import { useSend, useSnacks, useTea, type SnackRow, type Snacks, type Tea } from "@/lib/queries";

const TILE = ["var(--duo-gold-soft)", "var(--duo-green)", "var(--duo-grape)", "var(--duo-sky)"];
const TILT = [-6, 5, -4, 6];
const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}`; };

function ChaiCard({ tea }: { tea: Tea }) {
  const toggle = useSend<{ going: boolean }, Tea>(["tea"], "/api/tea", "POST", { replace: true });
  const at = hhmm(tea.roundAt);
  return (
    <section aria-label="Chai round" style={{ background: "var(--duo-gold-soft)", color: "var(--duo-gold-text)", borderRadius: 24, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flexShrink: 0 }}><Lappy pose={tea.mine ? "tea" : "idle"} width={110} /></div>
      <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>{tea.mine ? `Chai at ${at}: you’re in` : `Chai at ${at}?`}</span>
        <span style={{ fontSize: 14, fontWeight: 800 }} aria-live="polite">{tea.count} in today’s round · admin counts at {hhmm(tea.countsAt)}</span>
        <Button aria-pressed={tea.mine} disabled={toggle.isPending} style={{ alignSelf: "flex-start", minHeight: 52, fontSize: 18, ...(tea.mine ? { background: "var(--duo-seg-on)", color: "var(--duo-ink)", boxShadow: "0 5px 0 var(--duo-seg-on-edge)" } : {}) }}
          onClick={() => toggle.mutate({ going: !tea.mine }, { onSuccess: (t) => toast.success(t.mine ? "You’re in for chai" : "Dropped out of today’s round"), onError: (e) => toast.error(e.message) })}>
          <Coffee size={20} aria-hidden="true" />{tea.mine ? "You’re in" : "Count me in"}
        </Button>
      </div>
    </section>
  );
}

function snackSub(s: SnackRow, i: number) {
  if (s.note) return s.note;
  if (s.orderedAt) return `Restocked ${relativeDay(s.orderedAt).toLowerCase()}`;
  return i === 0 && s.votes > 0 ? "Top pick" : "On the shelf";
}

function VoteButton({ s }: { s: SnackRow }) {
  const vote = useSend<{ id: string; action: "vote" }, Snacks>(["snacks"], "/api/snacks", "PATCH", { replace: true });
  return (
    <button type="button" aria-pressed={s.mine} aria-label={`I’d like ${s.name}, ${s.votes}`} disabled={vote.isPending}
      className={s.mine ? "duo-btn duo-btn-p" : "duo-btn duo-btn-g"} style={{ minHeight: 44, minWidth: 64, padding: "0 12px", borderRadius: 14 }}
      onClick={() => vote.mutate({ id: s.id, action: "vote" }, { onError: (e) => toast.error(e.message) })}>
      <Heart size={16} fill={s.mine ? "currentColor" : "none"} aria-hidden="true" />{s.votes}
    </button>
  );
}

function Suggest() {
  const [name, setName] = useState("");
  const add = useSend<{ name: string }, Snacks>(["snacks"], "/api/snacks", "POST", { replace: true });
  return (
    <Card>
      <form style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
        onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; add.mutate({ name }, { onSuccess: () => { setName(""); toast.success("Suggested. Nobody can see it was you."); }, onError: (err) => toast.error(err.message) }); }}>
        <label style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="duo-label">Craving something else?</span>
          <input className="duo-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Dark chocolate, murukku…" />
        </label>
        <Button type="submit" disabled={add.isPending || !name.trim()} style={{ minHeight: 50 }}>Suggest</Button>
      </form>
    </Card>
  );
}

function Suggestions({ list }: { list: SnackRow[] }) {
  const vote = useSend<{ id: string; action: "vote" }, Snacks>(["snacks"], "/api/snacks", "PATCH", { replace: true });
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>Suggested by the team</span>
        <span className="duo-sub" style={{ fontSize: 12 }}>Popular ones move onto the shelf.</span>
      </div>
      {list.length === 0 && <span className="duo-sub" style={{ fontSize: 13 }}>No suggestions yet. Be the first.</span>}
      {list.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{s.name}</span>
            <span className="duo-sub" style={{ fontSize: 12 }}>{s.votes} {s.votes === 1 ? "person wants" : "people want"} it</span>
          </span>
          <Button variant={s.mine ? "primary" : "ghost"} aria-pressed={s.mine} aria-label={`Me too, ${s.name}`} disabled={vote.isPending} style={{ minHeight: 40, padding: "0 12px" }}
            onClick={() => vote.mutate({ id: s.id, action: "vote" }, { onError: (e) => toast.error(e.message) })}>{s.mine ? "✓ +1" : "+1"}</Button>
        </div>
      ))}
    </Card>
  );
}

export function SnacksPage() {
  const tea = useTea();
  const snacks = useSnacks();
  const head = <PageHeader title="Tea & snacks" subtitle="One chai round a day, and a say in what gets stocked" actions={<BellLink />} />;
  const rail = snacks.data && (
    <>
      <Suggestions list={snacks.data.suggestions} />
      <Flat style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>How it works</span>
        <span className="duo-sub" style={{ fontSize: 13 }}>Nobody, including admins, can see who voted or suggested.</span>
        <span className="duo-sub" style={{ fontSize: 13 }}>Admin orders the top picks. No quantities, no payment here.</span>
      </Flat>
    </>
  );
  return (
    <Split head={head} rail={rail}>
      {tea.data ? <ChaiCard tea={tea.data} /> : <QueryState error={tea.error} onRetry={() => tea.refetch()} what="the chai round" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h2 className="duo-h2">Snack shelf</h2>
        <span className="duo-sub">Tap to say you’d like it. Votes are anonymous. Top picks get stocked.</span>
      </div>
      {!snacks.data ? <QueryState error={snacks.error} onRetry={() => snacks.refetch()} what="the snack shelf" /> : (
        <>
          {snacks.data.shelf.length === 0 ? (
            <Flat style={{ display: "flex", alignItems: "center", gap: 12 }}><Lappy pose="idle" width={80} decorative /><span className="duo-sub">The shelf is empty. Suggest something below and admins will stock the favourites.</span></Flat>
          ) : (
            <div className="duo-grid2">
              {snacks.data.shelf.map((s, i) => (
                <Card key={s.id} style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 16, background: TILE[i % 4], transform: `rotate(${TILT[i % 4]}deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "var(--duo-display)", fontSize: 22, fontWeight: 700 }}>{s.name[0]?.toUpperCase()}</span>
                  <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600, lineHeight: 1.15 }}>{s.name}</span>
                    <span className="duo-sub" style={{ fontSize: 12 }}>{snackSub(s, i)}</span>
                  </span>
                  <VoteButton s={s} />
                </Card>
              ))}
            </div>
          )}
          <Suggest />
        </>
      )}
    </Split>
  );
}
