"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import { useMarkDay } from "@/lib/queries";
import type { Day } from "./calendar";
import { fullDay, shortDay } from "./format";

const CHOICES = [["office", "In office"], ["none", "Not in office"]] as const;

// One of your last 7 days: were you in the office? Not coming in means remote, so it's yes or no.
export function FixSheet({ day, onClose }: { day: Day; onClose: () => void }) {
  const mark = useMarkDay();
  const [choice, setChoice] = useState<"office" | "none" | null>(null);
  const save = () => choice && mark.mutate({ mode: choice, date: day.date }, {
    onSuccess: () => { toast.success(`${shortDay(day.date)} saved`); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Sheet open onClose={onClose} label="Fix a day">
      <div>
        <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>{fullDay(day.date)}</h2>
        <span className="m3-small">{day.mode === "office" ? "Marked in office" : "Nothing marked"}</span>
      </div>
      <div role="radiogroup" aria-label="Were you in the office?" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {CHOICES.map(([value, label]) => {
          const on = choice === value;
          return (
            <button key={value} type="button" role="radio" aria-checked={on} onClick={() => setChoice(value)}
              style={{ minHeight: 48, borderRadius: 16, border: on ? "2px solid var(--m3-primary)" : "1px solid #DFE3E8", background: on ? "#EAF4FC" : "var(--m3-surface)", color: "var(--m3-on-surface)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{label}</button>
          );
        })}
      </div>
      <p className="m3-small" style={{ margin: 0, background: "var(--m3-surface-container)", borderRadius: 12, padding: 12 }}>Marked later, so there's no location check. Admins can see it was added after the day. Every change is logged.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button disabled={!choice || mark.isPending} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}

export function LockedSheet({ day, onClose }: { day: Day; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} label="Day locked">
      <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>{shortDay(day.date)} is locked</h2>
      <p className="m3-body" style={{ margin: 0 }}>You can fix your own last 7 days. Anything older needs an admin.</p>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={onClose}>OK</Button></div>
    </Sheet>
  );
}
