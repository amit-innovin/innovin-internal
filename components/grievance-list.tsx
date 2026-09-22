"use client";

import { useRouter } from "next/navigation";
import type { GrievanceStatus } from "@/lib/types";

const STATUSES: { value: GrievanceStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

type Item = { id: string; body: string; displayName: string | null; status: GrievanceStatus };

export default function GrievanceList({ items }: { items: Item[] }) {
  const router = useRouter();

  async function setStatus(id: string, status: GrievanceStatus) {
    await fetch("/api/grievances", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  return (
    <ul className="mt-3 space-y-3 text-sm">
      {items.map((g) => (
        <li key={g.id} className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{g.displayName ?? "Anonymous"}</span>
            <select
              value={g.status}
              onChange={(e) => setStatus(g.id, e.target.value as GrievanceStatus)}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-slate-700">{g.body}</p>
        </li>
      ))}
      {items.length === 0 && <li className="text-slate-400">Nothing reported yet.</li>}
    </ul>
  );
}
