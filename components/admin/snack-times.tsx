"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card } from "@/components/duo";
import { useSetSnackTimes, useSnacks, useSnackTimes, useTea, type SnackTimes } from "@/lib/queries";

const FIELDS: [keyof SnackTimes, string][] = [
  ["amAt", "Morning tea round"], ["amClose", "Answers close"],
  ["pmAt", "Afternoon tea round"], ["pmClose", "Answers close"],
  ["orderAt", "Snack order goes in"],
];

// Admin › Snacks & tea (prototype: docs/design/m3/M3AdminSnacks.dc.html): the times people see,
// and today's numbers. Tea names are one tap away because admins make the round; snack picks are
// only ever counts.
export function SnackTimesCard() {
  const saved = useSnackTimes();
  const save = useSetSnackTimes();
  const [draft, setDraft] = useState<SnackTimes | null>(null);
  useEffect(() => { if (saved.data && !draft) setDraft(saved.data); }, [saved.data, draft]);
  if (!draft || !saved.data) return null;
  const changed = FIELDS.some(([k]) => draft[k] !== saved.data[k]);
  const amBad = draft.amClose >= draft.amAt, pmBad = draft.pmClose >= draft.pmAt, orderBad = draft.amAt > draft.pmClose;
  const filled = FIELDS.every(([k]) => /^\d{2}:\d{2}$/.test(draft[k]));
  return (
    <Card role="region" aria-labelledby="times-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 id="times-h" className="duo-h2">Times</h2>
      <span className="duo-sub" style={{ fontSize: 13 }}>Times for tea rounds and the daily snack order. People see these times in the app.</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {FIELDS.map(([k, label]) => (
          <label key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">{label}</span>
            <input type="time" className="duo-input" aria-label={k === "amClose" ? "Morning answers close" : k === "pmClose" ? "Afternoon answers close" : label} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      {orderBad && !amBad && !pmBad && <span role="alert" className="duo-sub" style={{ color: "var(--duo-pink-text, #8C1D40)" }}>The morning round must come before the afternoon round&apos;s answers close.</span>}
      {(amBad || pmBad) && <span role="alert" className="duo-sub" style={{ color: "var(--duo-pink-text, #8C1D40)" }}>Answers must close before the round.</span>}
      <Button style={{ alignSelf: "flex-start" }} disabled={!changed || amBad || pmBad || orderBad || !filled || save.isPending}
        onClick={() => save.mutate(draft, { onSuccess: () => toast.success("Times saved"), onError: (e) => toast.error(e.message) })}>Save times</Button>
    </Card>
  );
}

export function TodayCard() {
  const tea = useTea();
  const snacks = useSnacks();
  const [names, setNames] = useState(false);
  if (!tea.data || !snacks.data) return null;
  const counts = tea.data.counts ?? { am: 0, pm: 0 };
  const picks = snacks.data.shelf.map((s) => ({ name: s.name, n: snacks.data.today.picks?.find((p) => p.itemId === s.id)?.count ?? 0 })).filter((p) => p.n > 0).sort((a, b) => b.n - a.n);
  return (
    <Card role="region" aria-labelledby="today-admin-h" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 id="today-admin-h" className="duo-h2">Today</h2>
      <span>Morning round: {counts.am} having tea</span>
      <span>Afternoon round: {counts.pm} having tea</span>
      <Button variant="text" style={{ alignSelf: "flex-start" }} onClick={() => setNames(!names)}>{names ? "Hide names" : "Show names"}</Button>
      {names && (
        <span className="duo-sub" style={{ fontSize: 13 }}>
          Morning: {tea.data.names?.am.join(" · ") || "nobody yet"}<br />Afternoon: {tea.data.names?.pm.join(" · ") || "nobody yet"}
        </span>
      )}
      <span>Snack picks: {picks.length ? picks.map((p) => `${p.name} ${p.n}`).join(" · ") : "none yet"}</span>
      <span className="duo-sub" style={{ fontSize: 12 }}>Picks are anonymous, for admins too.</span>
    </Card>
  );
}
