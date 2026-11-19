"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import type { DaysView } from "@/lib/days";
import { useLeaveBalances, usePlanDay } from "@/lib/queries";
import type { Day } from "./calendar";
import { fullDay, shortDay } from "./format";

// Tap a future date: plan it in or out, or apply for leave. Today (before check-in): leave only.
// Leave is applied in Zoho People, where each person's approver decides (canvas: day sheet).
export function DaySheet({ day, leaveOnly, onClose }: { view: DaysView; day: Day; leaveOnly: boolean; onClose: () => void }) {
  const plan = usePlanDay();
  const balances = useLeaveBalances();
  const [leaving, setLeaving] = useState(leaveOnly);
  const zoho = balances.data?.applyUrl ?? "https://people.zoho.com/";

  const togglePlan = () => plan.mutate({ date: day.date, planned: !day.planned }, {
    onSuccess: () => { toast.success(day.planned ? `${shortDay(day.date)} taken out of your plan` : `${shortDay(day.date)} planned`); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Sheet open onClose={onClose} label="Plan this day">
      <div>
        <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>{fullDay(day.date)}</h2>
        <span className="m3-small">{leaveOnly ? "Not checked in yet" : day.planned ? "You're planned to come in" : "Not planned yet"}</span>
      </div>
      {!leaving ? (
        <div className="m3-stack" style={{ gap: 8 }}>
          <Button className="m3-btn-lg" disabled={plan.isPending} onClick={togglePlan}>{day.planned ? "Remove from my plan" : "Plan to come in"}</Button>
          <Button className="m3-btn-lg" variant="tonal" onClick={() => setLeaving(true)}>Apply for leave</Button>
        </div>
      ) : (
        <div className="m3-stack" style={{ gap: 14 }}>
          <h3 className="m3-title">Leave is applied in Zoho People</h3>
          <span className="m3-body" style={{ color: "var(--m3-on-surface-variant)" }}>Your approver decides there, and your balances show here.</span>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button variant="text" onClick={leaveOnly ? onClose : () => setLeaving(false)}>{leaveOnly ? "Cancel" : "Back"}</Button>
            <a href={zoho} target="_blank" rel="noopener noreferrer" className="m3-btn m3-btn-filled" onClick={onClose}>Apply in Zoho People<ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
      )}
    </Sheet>
  );
}
