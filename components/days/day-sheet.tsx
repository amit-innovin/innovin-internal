"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import type { DaysView } from "@/lib/days";
import { readError, send } from "@/lib/fetcher";
import { isWorkingDay } from "@/lib/leave";
import { queryKeys, useLeaveBalances, usePlanDay } from "@/lib/queries";
import type { Day } from "./calendar";
import { fullDay, LEAVE_NAMES, type LeaveKey, nextDate, shortDay } from "./format";

// The start date and the next five working days: how far one request from the calendar can run.
function untilOptions(view: DaysView, start: string) {
  const known = new Map(view.days.map((d) => [d.date, d.working]));
  const out = [start];
  for (let d = nextDate(start); out.length < 6; d = nextDate(d)) if (known.get(d) ?? isWorkingDay(d)) out.push(d);
  return out;
}

export function useRequestLeave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { leaveType: LeaveKey; startDate: string; endDate: string; halfDay: boolean }) => {
      const res = await send("/api/away", { method: "POST", json: { type: "leave", reason: "", ...input } });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ["away", "mine"] }),
      client.invalidateQueries({ queryKey: ["leave"] }),
      client.invalidateQueries({ queryKey: queryKeys.days() }),
    ]),
  });
}

// Tap a future date: plan it in or out, or apply for leave. Today (before check-in): leave only.
export function DaySheet({ view, day, leaveOnly, onClose }: { view: DaysView; day: Day; leaveOnly: boolean; onClose: () => void }) {
  const plan = usePlanDay();
  const request = useRequestLeave();
  const balances = useLeaveBalances();
  const [leaving, setLeaving] = useState(leaveOnly);
  const [type, setType] = useState<LeaveKey | null>(null);
  const [half, setHalf] = useState(false);
  const options = untilOptions(view, day.date);
  const [until, setUntil] = useState(day.date);
  const known = new Map(view.days.map((d) => [d.date, d.working]));
  const cost = half ? 0.5 : options.filter((d) => d <= until).filter((d) => known.get(d) ?? isWorkingDay(d)).length;
  const canHalf = type === "cl" && until === day.date;

  const togglePlan = () => plan.mutate({ date: day.date, planned: !day.planned }, {
    onSuccess: () => { toast.success(day.planned ? `${shortDay(day.date)} taken out of your plan` : `${shortDay(day.date)} planned`); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const sendRequest = () => type && request.mutate({ leaveType: type, startDate: day.date, endDate: until, halfDay: canHalf && half }, {
    onSuccess: () => { toast.success("Leave requested"); onClose(); },
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
        <div className="m3-stack" style={{ gap: 12 }}>
          <span className="m3-title" style={{ fontSize: 16 }}>Type of leave</span>
          <div role="group" aria-label="Type of leave" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {(balances.data?.ledger ?? []).filter((l) => l.type in LEAVE_NAMES).map((l) => {
              const on = type === l.type;
              const left = l.remaining - l.pending;
              // A single day can always be a half day of Casual; a longer request needs its full cost.
              const short = left < (until === day.date ? 0.5 : cost);
              return (
                <button key={l.type} type="button" aria-pressed={on} disabled={short} onClick={() => { setType(l.type); if (l.type !== "cl") setHalf(false); }}
                  style={{ textAlign: "left", borderRadius: 16, padding: "12px 14px", border: on ? "2px solid var(--m3-primary)" : "1px solid #DFE3E8", background: on ? "#EAF4FC" : "var(--m3-surface)", color: "var(--m3-on-surface)", opacity: short ? 0.45 : 1, display: "flex", flexDirection: "column", gap: 2, fontFamily: "inherit", cursor: short ? "default" : "pointer" }}>
                  <span style={{ fontWeight: 600 }}>{LEAVE_NAMES[l.type]}</span>
                  <span className="m3-small">{left} left{l.pending ? " (incl. pending)" : ""}</span>
                </button>
              );
            })}
          </div>
          {!leaveOnly && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}>Until</span>
              <select value={until} onChange={(e) => { setUntil(e.target.value); setHalf(false); }} style={{ height: 44, borderRadius: 12, border: "1px solid var(--m3-outline)", padding: "0 12px", fontFamily: "inherit", fontSize: 15, background: "var(--m3-surface)" }}>
                {options.map((d) => <option key={d} value={d}>{d === day.date ? `${shortDay(d)} (just this day)` : shortDay(d)}</option>)}
              </select>
              {until !== day.date && <span className="m3-small">Covers {cost} working days</span>}
            </label>
          )}
          {canHalf && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Half day</span>
              <button type="button" role="switch" aria-checked={half} aria-label="Half day" onClick={() => setHalf(!half)}
                style={{ flex: "none", width: 52, height: 32, borderRadius: 16, border: half ? 0 : "2px solid #71787E", background: half ? "var(--m3-primary)" : "#DFE3E8", padding: 0, position: "relative", cursor: "pointer" }}>
                <span style={{ position: "absolute", top: "50%", left: half ? 24 : 6, width: half ? 24 : 16, height: half ? 24 : 16, borderRadius: 12, background: half ? "#FFFFFF" : "#71787E", transform: "translateY(-50%)", transition: "left .15s ease" }} />
              </button>
            </div>
          )}
          <p className="m3-small" style={{ margin: 0 }}>Your request goes for approval. You'll see its status here.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {!leaveOnly && <Button variant="text" onClick={() => setLeaving(false)}>Back</Button>}
            {leaveOnly && <Button variant="text" onClick={onClose}>Cancel</Button>}
            <Button disabled={!type || request.isPending} onClick={sendRequest}>Send request</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
