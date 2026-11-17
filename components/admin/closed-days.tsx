"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card } from "@/components/duo";
import { useAddClosedDay, useClosedDays, useRemoveClosedDay } from "@/lib/queries";
import { fmtDay } from "./admin-ui";

const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

// Admin › Closed days (prototype: docs/design/m3/M3AdminClosedDays.dc.html). A closed date is
// greyed out on everyone's Days calendar, can't be planned or checked in on, and costs no leave.
export function ClosedDays() {
  const list = useClosedDays();
  const add = useAddClosedDay();
  const remove = useRemoveClosedDay();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const submit = () => add.mutate({ date, reason: reason.trim() }, {
    onSuccess: () => { toast.success(`${fmtDay(date)} marked closed`); setDate(""); setReason(""); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Card role="region" aria-labelledby="closed-days-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 id="closed-days-h" className="duo-h2">Closed days</h2>
      <span className="duo-sub" style={{ fontSize: 13 }}>Dates the office is closed. They&apos;re greyed out on everyone&apos;s Days calendar, can&apos;t be planned, and nobody is expected in. They don&apos;t change the monthly target.</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Date</span>
          <input type="date" className="duo-input" min={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Reason</span>
          <input className="duo-input" maxLength={120} placeholder="Building maintenance" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <Button disabled={!date || !reason.trim() || add.isPending} onClick={submit}>Mark closed</Button>
      </div>
      {list.isError ? <span role="alert" className="duo-sub">{list.error.message}</span> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {(list.data ?? []).map((d) => (
            <li key={d.date} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "2px solid var(--duo-line)" }}>
              <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700 }}>{fmtDay(d.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="duo-sub" style={{ fontSize: 13 }}>{d.reason} · added by {d.createdBy}</span>
              </span>
              <Button variant="ghost" style={{ minHeight: 40, fontSize: 14 }} aria-label={`Remove ${fmtDay(d.date, { weekday: "long", day: "numeric", month: "long" })}`} disabled={remove.isPending}
                onClick={() => remove.mutate({ date: d.date }, { onSuccess: () => toast.success("Office open again that day"), onError: (e) => toast.error(e.message) })}>Remove</Button>
            </li>
          ))}
          {list.data?.length === 0 && <li className="duo-sub" style={{ fontSize: 13 }}>No closed days coming up.</li>}
        </ul>
      )}
      <span className="duo-sub" style={{ fontSize: 12 }}>Public holidays come from the company calendar and aren&apos;t listed here.</span>
    </Card>
  );
}
