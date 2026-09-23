"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarOff, Palmtree } from "lucide-react";
import { toast } from "sonner";
import { Empty, IconTile } from "@/components/kit";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Button } from "@/components/ui/button";
import { readError, send } from "@/lib/fetcher";
import { fmtShortDate, relativeTime } from "@/lib/format";
import type { AwayStatus, AwayType } from "@/lib/types";

type Item = {
  id: string;
  email: string;
  type: AwayType;
  startDate: string;
  endDate: string;
  reason: string;
  status: AwayStatus;
  decidedBy: string | null;
  createdAt: string;
};

const META: Record<AwayStatus, { label: string; badge: "warning" | "success" | "danger" }> = {
  pending: { label: "Pending", badge: "warning" },
  approved: { label: "Approved", badge: "success" },
  rejected: { label: "Rejected", badge: "danger" },
};

const fmtRange = (s: string, e: string) =>
  s === e ? fmtShortDate(`${s}T00:00:00`) : `${fmtShortDate(`${s}T00:00:00`)} – ${fmtShortDate(`${e}T00:00:00`)}`;

export default function AwayList({ items, names, now }: { items: Item[]; names: Record<string, string>; now?: number }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, AwayStatus>>({});

  async function setStatus(id: string, status: AwayStatus) {
    setStatuses((s) => ({ ...s, [id]: status }));
    const res = await send("/api/away", { method: "PATCH", json: { id, status } });
    if (res.ok) {
      toast.success(`Request ${status}`);
    } else {
      setStatuses(({ [id]: _dropped, ...rest }) => rest);
      toast.error(res.status === 401 ? "Your admin session expired — sign in again." : await readError(res));
    }
    router.refresh();
  }

  if (items.length === 0) return <Empty>No leave or WFH requests yet.</Empty>;

  return (
    <ul className="mt-2 divide-y">
      {items.map((r) => {
        const status = statuses[r.id] ?? r.status;
        return (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <IconTile icon={r.type === "leave" ? Palmtree : CalendarOff} tone={r.type === "leave" ? "amber" : "sky"} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {names[r.email] ? `${names[r.email]} · ` : ""}{r.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.type === "leave" ? "Leave" : "WFH"} · {fmtRange(r.startDate, r.endDate)} · {relativeTime(r.createdAt, now)}
              </p>
              {r.reason && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.reason}</p>}
              {status !== "pending" && r.decidedBy && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {META[status].label} by {r.decidedBy}
                </p>
              )}
            </div>
            {status === "pending" ? (
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-emerald-700" onClick={() => setStatus(r.id, "approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-rose-600" onClick={() => setStatus(r.id, "rejected")}>
                  Reject
                </Button>
              </div>
            ) : (
              <AnimatedBadge status={META[status].badge} size="sm" contentKey={status} className="shrink-0">
                {META[status].label}
              </AnimatedBadge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
