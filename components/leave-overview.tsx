"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { readError, send } from "@/lib/fetcher";
import { LEAVE_LABELS, type LeaveType } from "@/lib/leave";

type Ledger = { type: LeaveType; entitled: number; used: number; pending: number; remaining: number };
type Person = { name: string; email: string | null; joinedOn: string | null; summary: { ledger: Ledger[]; imported: boolean } };

const days = (n: number) => `${Number(n.toFixed(1))}`;

function Balances({ ledger }: { ledger: Ledger[] }) {
  return (
    <div className="flex shrink-0 gap-3 text-right text-xs tabular-nums">
      {ledger.map((row) => (
        <div key={row.type} className="w-12">
          <p className={`font-medium ${row.remaining < 0 ? "text-rose-600" : ""}`}>{days(row.remaining)}</p>
          <p className="text-[10px] text-muted-foreground">{LEAVE_LABELS[row.type]}</p>
        </div>
      ))}
    </div>
  );
}

// Everyone's remaining leave, plus inline editing of the joining date that Earned Leave needs.
export default function LeaveOverview({ signedIn, unmatched }: { signedIn: Person[]; unmatched: Person[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setJoinedOn(email: string, joinedOn: string) {
    setBusy(email);
    const res = await send("/api/people", { method: "PATCH", json: { email, joinedOn } });
    if (res.ok) {
      toast.success(joinedOn ? "Joining date saved" : "Joining date cleared");
      router.refresh();
    } else {
      toast.error(await readError(res));
    }
    setBusy(null);
  }

  return (
    <>
      <ul className="mt-2 divide-y">
        {signedIn.map((p) => (
          <li key={p.email} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <label className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {p.joinedOn ? "Joined" : "Add joining date"}
                <input
                  type="date"
                  defaultValue={p.joinedOn ?? ""}
                  disabled={busy === p.email}
                  aria-label={`Joining date for ${p.name}`}
                  onChange={(e) => p.email && setJoinedOn(p.email, e.target.value)}
                  className="rounded border border-input bg-card px-1.5 py-0.5 text-xs outline-none focus-visible:border-ring"
                />
              </label>
            </div>
            <Balances ledger={p.summary.ledger} />
          </li>
        ))}
      </ul>

      {unmatched.length > 0 && (
        <>
          <p className="mt-5 border-t pt-4 text-xs font-medium text-muted-foreground">
            From the 2026 sheet · not signed in yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            These balances come from the imported tracker. They&apos;ll attach automatically once the person signs in with a
            matching Google name.
          </p>
          <ul className="mt-2 divide-y">
            {unmatched.map((p) => (
              <li key={p.name} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.name}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  imported
                </Badge>
                <Balances ledger={p.summary.ledger} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
