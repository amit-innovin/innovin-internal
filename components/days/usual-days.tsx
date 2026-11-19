"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useSetOfficeDays } from "@/lib/queries";

const DAYS = [["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"]] as const;

// The weekdays you usually come in (Monday = 0). Each tap saves; single dates change on the calendar.
export function UsualDays({ officeDays }: { officeDays: number[] }) {
  const save = useSetOfficeDays();
  const [picked, setPicked] = useState(officeDays);
  const toggle = (i: number) => {
    const next = picked.includes(i) ? picked.filter((d) => d !== i) : [...picked, i].sort((a, b) => a - b);
    const before = picked;
    setPicked(next);
    save.mutate(next, { onError: (e) => { setPicked(before); toast.error(e.message); } });
  };
  return (
    <section aria-labelledby="days-usual" className="m3-card m3-stack" style={{ gap: 12 }}>
      <h2 id="days-usual" className="m3-title">Your usual office days</h2>
      <div role="group" aria-labelledby="days-usual" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {DAYS.map(([short, full], i) => {
          const on = picked.includes(i);
          return (
            <button key={short} type="button" aria-pressed={on} aria-label={full} onClick={() => toggle(i)}
              style={{ height: 40, minWidth: 52, padding: "0 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: on ? "1px solid var(--m3-secondary-container)" : "1px solid var(--m3-outline)", background: on ? "var(--m3-secondary-container)" : "transparent", color: on ? "var(--m3-on-secondary-container)" : "var(--m3-on-surface-variant)" }}>{short}</button>
          );
        })}
      </div>
      <span className="m3-small">These repeat every week. Change single dates on the calendar.</span>
    </section>
  );
}
