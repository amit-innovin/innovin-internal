"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StatusChip, type ChipTone } from "@/components/m3";
import { readError, send } from "@/lib/fetcher";
import { queryKeys, useLeaveBalances, useMyLeaveRequests, type MyLeaveRequest } from "@/lib/queries";
import { LEAVE_NAMES, type LeaveKey, shortDay } from "./format";

const STATUS: Record<MyLeaveRequest["status"], [string, ChipTone]> = { pending: ["Pending", "warn"], approved: ["Approved", "success"], rejected: ["Rejected", "neutral"], cancelled: ["Cancelled", "neutral"] };
const name = (r: MyLeaveRequest) => `${LEAVE_NAMES[r.leaveType as LeaveKey] ?? "Other"} leave`;
const when = (r: MyLeaveRequest) => `${r.startDate === r.endDate ? shortDay(r.startDate) : `${shortDay(r.startDate)} – ${shortDay(r.endDate)}`} · ${r.halfDay ? "Half day" : `${r.days} day${r.days === 1 ? "" : "s"}`}`;

function useCancelLeave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await send("/api/away", { method: "PATCH", json: { id, status: "cancelled" } });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["away", "mine"] }), client.invalidateQueries({ queryKey: ["leave"] }), client.invalidateQueries({ queryKey: queryKeys.days() })]),
  });
}

// Your recent leave requests and where each stands. Pending or upcoming leave can be cancelled.
export function LeaveRequests({ today }: { today: string }) {
  const requests = useMyLeaveRequests();
  const zoho = useLeaveBalances().data?.zoho;
  const approved = zoho?.data?.approved ?? [];
  const cancel = useCancelLeave();
  const rows = (requests.data ?? []).filter((r) => r.type === "leave").slice(0, 6);
  return (
    <section aria-labelledby="days-leave" className="m3-stack" style={{ gap: 8 }}>
      <h2 id="days-leave" className="m3-title" style={{ padding: "0 4px" }}>Your leave requests</h2>
      <div className="m3-card" style={{ padding: 0, overflow: "hidden" }}>
        {requests.isError ? <p role="alert" className="m3-small" style={{ margin: 0, padding: 16 }}>{requests.error.message}</p>
          : rows.length === 0 && approved.length === 0 ? <p className="m3-small" style={{ margin: 0, padding: 16 }}>{requests.isPending ? "Loading…" : "No leave to show here. Open Zoho People for all your requests."}</p>
          : rows.map((r) => {
            const [label, tone] = STATUS[r.status];
            const canCancel = r.status === "pending" || (r.status === "approved" && r.startDate > today);
            return (
              <div key={r.id} className="m3-row">
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span>{name(r)}</span>
                  <span className="m3-small">{when(r)}</span>
                </span>
                <StatusChip tone={tone}>{label}</StatusChip>
                {canCancel && (
                  <button type="button" className="m3-btn m3-btn-text" style={{ flex: "none", padding: "0 8px" }} aria-label={`Cancel ${name(r)}, ${when(r)}`} disabled={cancel.isPending}
                    onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.success("Request cancelled"), onError: (e) => toast.error(e.message) })}>Cancel</button>
                )}
              </div>
            );
          })}
        {[...approved].reverse().slice(0, 6).map((row) => (
          <div key={row.id} className="m3-row">
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span>{row.type}</span>
              <span className="m3-small">{row.from === row.to ? shortDay(row.from) : `${shortDay(row.from)} – ${shortDay(row.to)}`} · Zoho People{zoho?.state === "stale" ? " (last available)" : ""}</span>
            </span>
            <StatusChip tone="success">Approved</StatusChip>
          </div>
        ))}
      </div>
    </section>
  );
}
