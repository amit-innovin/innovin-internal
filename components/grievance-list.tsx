"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ImagePreview } from "@/components/image-preview";
import { Empty, STATUS_META, StatusPill } from "@/components/kit";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { readError, send } from "@/lib/fetcher";
import { fmtTime, relativeDay } from "@/lib/format";
import type { GrievanceStatus } from "@/lib/types";

type Item = { id: string; body: string; displayName: string | null; image: string | null; status: GrievanceStatus; createdAt: string };

export default function GrievanceList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, GrievanceStatus>>({});

  async function setStatus(id: string, status: GrievanceStatus) {
    setStatuses((s) => ({ ...s, [id]: status }));
    const res = await send("/api/grievances", { method: "PATCH", json: { id, status } });
    if (res.ok) {
      toast.success(`Marked as ${STATUS_META[status].label.toLowerCase()}`);
    } else {
      // Roll back the optimistic update.
      setStatuses(({ [id]: _dropped, ...rest }) => rest);
      toast.error(res.status === 401 ? "Your admin session expired — sign in again." : await readError(res));
    }
    router.refresh();
  }

  if (items.length === 0) return <Empty>Nothing reported yet.</Empty>;

  return (
    <ul className="mt-2 divide-y">
      {items.map((g) => {
        const status = statuses[g.id] ?? g.status;
        return (
          <li key={g.id} className="py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{g.displayName ?? "Anonymous"}</span> · {relativeDay(g.createdAt)},{" "}
                {fmtTime(g.createdAt)}
              </p>
              <Select value={status} onValueChange={(v) => setStatus(g.id, v as GrievanceStatus)}>
                <SelectTrigger size="sm" aria-label="Status" className="h-auto rounded-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-2">
                  <StatusPill status={status} />
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  {(Object.keys(STATUS_META) as GrievanceStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{g.body}</p>
            {g.image && <ImagePreview src={g.image} alt="Attached photo" className="mt-2" />}
          </li>
        );
      })}
    </ul>
  );
}
