"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Empty } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { readError, send } from "@/lib/fetcher";
import { fmtLeaveDays, LEAVE_LABELS, type LeaveType } from "@/lib/leave";

type Ledger = { type: LeaveType; entitled: number; used: number; pending: number; remaining: number };
type Person = { name: string; email: string | null; joinedOn: string | null; summary: { ledger: Ledger[]; imported: boolean } };

function Balances({ ledger }: { ledger: Ledger[] }) {
  return (
    <div className="flex shrink-0 gap-3 text-right text-xs tabular-nums">
      {ledger.map((row) => (
        <div key={row.type} className="w-12">
          <p className={`font-medium ${row.remaining < 0 ? "text-rose-600" : ""}`}>{fmtLeaveDays(row.remaining)}</p>
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
  const [query, setQuery] = useState("");
  // The imported sheet adds ~20 people nobody needs to scroll past by default.
  const [showImported, setShowImported] = useState(false);

  const match = (p: Person) => p.name.toLowerCase().includes(query.trim().toLowerCase());
  const visible = signedIn.filter(match);
  const visibleImported = unmatched.filter(match);

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
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people"
        aria-label="Search people"
        className="mt-3 h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      {visible.length === 0 && query && <Empty>Nobody signed in matches “{query}”.</Empty>}
      <ul className="mt-2 divide-y">
        {visible.map((p) => (
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
          <button
            type="button"
            onClick={() => setShowImported((v) => !v)}
            aria-expanded={showImported}
            className="mt-5 flex w-full items-center justify-between gap-3 border-t pt-4 text-left"
          >
            <span className="text-xs font-medium text-muted-foreground">
              From the 2026 sheet · not signed in yet ({unmatched.length})
            </span>
            <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${showImported ? "rotate-180" : ""}`} />
          </button>
          {showImported && (
            <p className="mt-1 text-xs text-muted-foreground">
              These balances come from the imported tracker. They&apos;ll attach automatically once the person signs in with a
              matching Google name.
            </p>
          )}
          <ul className={`mt-2 divide-y ${showImported ? "" : "hidden"}`}>
            {visibleImported.map((p) => (
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
