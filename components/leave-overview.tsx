"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Empty } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { readError, send } from "@/lib/fetcher";
import { fmtShortDate } from "@/lib/format";
import { fmtLeaveDays, LEAVE_LABELS } from "@/lib/leave";

const TYPES = ["cl", "sl", "el", "fl"] as const;
type BalanceType = (typeof TYPES)[number];

type Ledger = { type: string; entitled: number; used: number; pending: number; remaining: number };
type Person = {
  name: string;
  email: string;
  joinedOn: string | null;
  stepsOffset: number;
  summary: { ledger: Ledger[]; source: "zoho-snapshot" | "app-only"; asOf: string | null };
};

// Zoho People holds the real balances, so an admin copies each person's "Available" figures in
// here. Everything requested through this app after that is counted on top, which is why the
// snapshot date is shown rather than hidden.
export default function LeaveOverview({ people }: { people: Person[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const visible = people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function save(email: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const available: Record<string, number> = {};
    for (const t of TYPES) {
      const raw = String(data.get(t) ?? "").trim();
      if (raw !== "") available[t] = Number(raw);
    }
    const stepsRaw = String(data.get("stepsOffset") ?? "").trim();
    setBusy(email);
    const res = await send("/api/leave", { method: "PATCH", json: { email, available } });
    if (res.ok && stepsRaw !== "") {
      const steps = await send("/api/people", { method: "PATCH", json: { email, stepsOffset: Number(stepsRaw) } });
      if (!steps.ok) {
        toast.error(await readError(steps));
        setBusy(null);
        return;
      }
    }
    if (res.ok) {
      toast.success("Saved");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(await readError(res));
    }
    setBusy(null);
  }

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

  if (people.length === 0) return <Empty>Nobody has signed in with Google yet.</Empty>;

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
      {visible.length === 0 && <Empty>Nobody matches “{query}”.</Empty>}

      <ul className="mt-2 divide-y">
        {visible.map((p) => {
          const open = editing === p.email;
          return (
            <li key={p.email} className="py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <label className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {p.joinedOn ? "Joined" : "Add joining date"}
                    <input
                      type="date"
                      defaultValue={p.joinedOn ?? ""}
                      disabled={busy === p.email}
                      aria-label={`Joining date for ${p.name}`}
                      onChange={(e) => setJoinedOn(p.email, e.target.value)}
                      className="rounded border border-input bg-card px-1.5 py-0.5 text-xs outline-none focus-visible:border-ring"
                    />
                  </label>
                </div>

                <div className="flex shrink-0 gap-3 text-right text-xs tabular-nums">
                  {p.summary.ledger.map((row) => (
                    <div key={row.type} className="w-11">
                      <p className={`font-medium ${row.remaining < 0 ? "text-rose-600" : ""}`}>{fmtLeaveDays(row.remaining)}</p>
                      <p className="text-[10px] text-muted-foreground">{LEAVE_LABELS[row.type as BalanceType]}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setEditing(open ? null : p.email)}
                  aria-expanded={open}
                  aria-label={`Edit balances for ${p.name}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">
                {p.summary.source === "zoho-snapshot" && p.summary.asOf ? (
                  <>From Zoho · as of {fmtShortDate(p.summary.asOf)}</>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    no Zoho figures yet — showing policy entitlement
                  </Badge>
                )}
              </p>

              {open && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(p.email, e.currentTarget);
                  }}
                  className="mt-3 rounded-lg border bg-muted/40 p-3"
                >
                  <p className="text-xs text-muted-foreground">
                    Copy the “Available” number from Zoho’s Leave Summary. Leave a box empty to keep using the policy
                    entitlement for that type.
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {TYPES.map((t) => (
                      <label key={t} className="text-[11px] text-muted-foreground">
                        {LEAVE_LABELS[t]}
                        <input
                          name={t}
                          type="number"
                          step="0.5"
                          min="0"
                          max="365"
                          aria-label={`${LEAVE_LABELS[t]} available for ${p.name}`}
                          defaultValue={p.summary.ledger.find((l) => l.type === t)?.remaining ?? ""}
                          className="mt-0.5 h-8 w-full rounded border border-input bg-card px-2 text-sm tabular-nums outline-none focus-visible:border-ring"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="mt-3 block text-[11px] text-muted-foreground">
                    10K challenge — days from the sheet
                    <input
                      name="stepsOffset"
                      type="number"
                      min="0"
                      step="1"
                      aria-label={`Sheet days so far for ${p.name}`}
                      defaultValue={p.stepsOffset || ""}
                      placeholder="0"
                      className="mt-0.5 h-8 w-28 rounded border border-input bg-card px-2 text-sm tabular-nums outline-none focus-visible:border-ring"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy === p.email}
                    className="mt-3 h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {busy === p.email ? "Saving…" : "Save"}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
