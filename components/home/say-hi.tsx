"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import { readError, send } from "@/lib/fetcher";
import type { HiKind } from "@/lib/types";

const OPTIONS: [HiKind, string][] = [["wave", "Wave"], ["five", "High five"], ["thanks", "Thanks!"], ["chai", "Chai break?"], ["lunch", "Lunch together?"], ["walk", "Walk?"]];
const INVITES: HiKind[] = ["chai", "lunch", "walk"];
const fmt = (min: number) => `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, "0")} ${min < 720 ? "am" : "pm"}`;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function useSayHiSetting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      const res = await send("/api/hi/setting", { method: "POST", json: { on } });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["days"] }), client.invalidateQueries({ queryKey: ["account"] })]),
  });
}

// "Say hi to {name}": a gesture, or an invite with a time. Up to 3 a day.
export function SayHiSheet({ person, sentToday, onClose }: { person: { email: string; name: string }; sentToday: number; onClose: () => void }) {
  const client = useQueryClient();
  const [pick, setPick] = useState<HiKind | null>(null);
  const [time, setTime] = useState<"now" | "30" | "pick" | null>(null);
  const [clock, setClock] = useState(600);
  const [busy, setBusy] = useState(false);
  const invite = !!pick && INVITES.includes(pick);
  const atLimit = sentToday >= 3;
  const ready = !!pick && (!invite || !!time) && !atLimit;
  const label = atLimit ? "You've sent 3 today" : pick ? `Send ${OPTIONS.find(([k]) => k === pick)![1].replace("?", "")}` : "Pick something to send";
  const submit = async () => {
    if (!pick) return;
    setBusy(true);
    const res = await send("/api/hi", { method: "POST", json: { to: person.email, kind: pick, time: invite ? (time === "pick" ? hhmm(clock) : time) : undefined } });
    setBusy(false);
    if (!res.ok) return toast.error(await readError(res));
    toast.success(`Sent to ${person.name}`);
    await client.invalidateQueries({ queryKey: ["days"] });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} label={`Say hi to ${person.name}`}>
      <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>Say hi to {person.name}</h2>
      <div role="group" aria-label="What to send" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {OPTIONS.map(([k, text]) => (
          <button key={k} type="button" aria-pressed={pick === k} onClick={() => { setPick(k); if (!INVITES.includes(k)) setTime(null); }}
            style={{ minHeight: 48, borderRadius: 14, border: pick === k ? "2px solid var(--m3-primary)" : "1px solid #DFE3E8", background: pick === k ? "#EAF4FC" : "var(--m3-surface)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--m3-on-surface)" }}>{text}</button>
        ))}
      </div>
      {invite && (
        <div className="m3-stack" style={{ gap: 8 }}>
          <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}>When?</span>
          <div role="group" aria-label="When" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {([["now", "Now"], ["30", "In 30 min"], ["pick", "Pick a time"]] as const).map(([k, text]) => (
              <button key={k} type="button" aria-pressed={time === k} onClick={() => setTime(k)} className={`m3-btn ${time === k ? "m3-btn-tonal" : "m3-btn-outlined"}`} style={{ height: 36, padding: "0 14px", fontSize: 14 }}>{text}</button>
            ))}
          </div>
          {time === "pick" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Button variant="outlined" aria-label="Earlier" onClick={() => setClock(Math.max(540, clock - 15))}>−</Button>
              <span aria-live="polite" style={{ minWidth: 80, textAlign: "center", fontWeight: 600 }}>{fmt(clock)}</span>
              <Button variant="outlined" aria-label="Later" onClick={() => setClock(Math.min(1140, clock + 15))}>+</Button>
            </div>
          )}
        </div>
      )}
      <Button className="m3-btn-lg" disabled={!ready || busy} onClick={submit}>{label}</Button>
      <span className="m3-small">Up to 3 a day, so nobody gets flooded. You can turn Say hi off in Account › Notification settings.</span>
    </Sheet>
  );
}

