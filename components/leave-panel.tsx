"use client";
import { LoadRecovery } from "@/components/load-recovery";

import { useEffect, useState } from "react";
import { CalendarOff, Info, Mail, Palmtree, Send } from "lucide-react";
import { toast } from "sonner";
import { AWAY_META, AWAY_TYPE_LABEL, Empty, IconTile, SectionHeader, Segmented, stagger } from "@/components/kit";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { StatefulButton } from "@/components/motion/button/stateful";
import { Input } from "@/components/motion/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getJSON, readError, send } from "@/lib/fetcher";
import { fmtDateRange, fmtShortDate, relativeTime } from "@/lib/format";
import { useButtonState } from "@/lib/hooks/use-button-state";
import { fmtLeaveDays, LEAVE_LABELS, type LeaveType } from "@/lib/leave";
import type { AwayStatus, AwayType } from "@/lib/types";
import { todayIST } from "@/lib/time";
import { ZohoLeave } from "@/components/zoho-leave";
import type { ZohoLeaveResult } from "@/lib/zoho-people";

type AwayRequest = {
  id: string;
  email: string;
  type: AwayType;
  startDate: string;
  endDate: string;
  reason: string;
  status: AwayStatus;
  createdAt: string;
};
type Auth = { signedIn: boolean; googleEnabled: boolean; email?: string; name?: string };
type Ledger = { type: LeaveType; entitled: number; used: number; pending: number; remaining: number };
type LeaveSummary = {
  signedIn: boolean;
  year: number;
  joinedOn?: string | null;
  source?: "zoho-snapshot" | "app-only";
  asOf?: string | null;
  zoho?: ZohoLeaveResult;
  ledger?: Ledger[];
  earned?: { accrued: number | null; canAvail: boolean; note: string | null };
};

const DESCRIPTION: Record<LeaveType, string> = {
  cl: "Short personal breaks · half-days allowed",
  sl: "Illness or health-related absence",
  el: "Accrues 1.25 days a month · usable after a year",
  fl: "For personal, cultural or religious observances",
  ml: "Maternity leave",
};


function Balance({ row }: { row: Ledger }) {
  const over = row.remaining < 0;
  return (
    <li className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{LEAVE_LABELS[row.type]} Leave</p>
        <p className={`shrink-0 text-sm font-medium tabular-nums ${over ? "text-rose-600" : ""}`}>
          {fmtLeaveDays(row.remaining)} <span className="text-xs font-normal text-muted-foreground">of {fmtLeaveDays(row.entitled)} left</span>
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{DESCRIPTION[row.type]}</p>
        {row.pending > 0 && (
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            {fmtLeaveDays(row.pending)} pending
          </Badge>
        )}
        {over && (
          <Badge variant="secondary" className="shrink-0 text-[11px] text-rose-600">
            over by {fmtLeaveDays(-row.remaining)}
          </Badge>
        )}
      </div>
    </li>
  );
}

// Balances, the request form and your own request history. Lives inside the Attendance page so
// "my time" is one surface; the holiday calendar sits in the Calendar tab next door.
// `rememberedEmail` comes from the attendance status above, so nobody types their address twice
// on this page — and it keeps the check-in card's email field the only one of its kind.
export default function LeavePanel({ rememberedEmail, focusRequest }: { rememberedEmail: string | null; focusRequest?: string | null }) {
  const [requests, setRequests] = useState<AwayRequest[] | null>(null);
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [type, setType] = useState<AwayType>("leave");
  const [leaveType, setLeaveType] = useState<LeaveType>("cl");
  const [halfDay, setHalfDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | false>(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [buttonState, run] = useButtonState();

  const load = async () => {
    const [mine, me, sum] = await Promise.all([
      getJSON<AwayRequest[]>("/api/away?scope=mine", "your requests"),
      getJSON<Auth>("/api/auth/me", "your sign-in"),
      getJSON<LeaveSummary>("/api/leave", "your leave balance"),
    ]);
    if (mine) setRequests(mine);
    if (me) setAuth(me);
    if (sum) setSummary(sum);
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => { if(focusRequest && requests) document.getElementById(`request-${focusRequest}`)?.scrollIntoView({block:"center",behavior:"smooth"}); },[focusRequest,requests]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      setError(false);
      const res = await send("/api/away", {
        method: "POST",
        json: {
          email: auth?.email ?? rememberedEmail ?? email,
          type,
          startDate,
          endDate,
          reason,
          ...(type === "leave" ? { leaveType, halfDay: halfDay && leaveType === "cl" } : {}),
        },
      });
      if (!res.ok) {
        setError(await readError(res));
        return false;
      }
      toast.success(`${AWAY_TYPE_LABEL[type]} request sent for approval`);
      setStartDate("");
      setEndDate("");
      setReason("");
      setEmail("");
      return true;
    }).then((ok) => {
      if (ok) load();
    });
  };

  const cancelRequest = async (id: string) => {
    const r = requests?.find((x) => x.id === id);
    const what = r ? AWAY_TYPE_LABEL[r.type] : "request";
    if (!window.confirm(`Cancel this ${what.toLowerCase()} request? Local estimates will update. Any leave already recorded in Zoho must also be cancelled there.`)) return;
    setCancelling(id);
    const res = await send("/api/away", { method: "PATCH", json: { id, status: "cancelled" } });
    if (res.ok) {
      toast.success("Request cancelled");
      await load();
    } else {
      toast.error(await readError(res));
    }
    setCancelling(null);
  };

  return (
    <>
      <Card className="gap-0 p-5">
        <SectionHeader
          title={`Balance · ${summary?.year ?? "…"}`}
          aside={summary?.joinedOn ? `Joined ${fmtShortDate(`${summary.joinedOn}T00:00:00`)}` : undefined}
        />
        {!summary ? (<LoadRecovery>
          <Skeleton className="mt-3 h-24 w-full" />
        </LoadRecovery>) : !summary.signedIn ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {/* A plain anchor: a Next Link would prefetch the OAuth route and trip CSP. */}
            <a href="/api/auth/google?next=/attendance" className="underline underline-offset-4">
              Sign in with Google
            </a>{" "}
            to see your leave balances — they&apos;re tied to your identity, not this device. You can still request time away
            below.
          </p>
        ) : summary.zoho?.data ? (
          <ZohoLeave result={summary.zoho} today={todayIST()} />
        ) : (
          <>
            {summary.zoho && <ZohoLeave result={summary.zoho} today={todayIST()} />}
            <ul className="mt-1 divide-y">
              {summary.ledger?.map((row, i) => (
                <div key={row.type} style={stagger(i)}>
                  <Balance row={row} />
                </div>
              ))}
            </ul>
            {/* Say where the numbers came from: Zoho People is the record, this is a snapshot
                with estimated local adjustments. Never let it look more authoritative. */}
            <p className="mt-4 flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {summary.source === "zoho-snapshot" && summary.asOf
                ? `From Zoho People as of ${fmtShortDate(summary.asOf)}, with estimated local adjustments. Only requests explicitly reconciled by an admin are treated as included. Zoho is the official record.`
                : "Showing your policy entitlement — an admin hasn't copied your Zoho balances in yet, so check Zoho People for the official numbers."}
            </p>
            {summary.earned?.note && (
              <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {summary.earned.note}
              </p>
            )}
          </>
        )}
      </Card>

      {!auth ? (<LoadRecovery>
        <Card className="mt-4 gap-3 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </Card>
      </LoadRecovery>) : (
        <Card className="mt-4 gap-0 p-6">
          <form onSubmit={submit}>
            <div className="flex items-center gap-3">
              <IconTile icon={Palmtree} tone="amber" size="lg" />
              <div>
                <h2 className="font-medium">Request time away</h2>
                <p className="text-sm text-muted-foreground">Sends to your office coordinator. Submission and approval here do not update Zoho People.</p>
              </div>
            </div>

            <div className="mt-5">
              <Segmented
                value={type}
                onChange={setType}
                options={[
                  { value: "leave", label: "Leave" },
                  { value: "wfh", label: "Work from home" },
                ]}
              />
            </div>

            {type === "leave" && (
              <div className="mt-4">
                <label htmlFor="away-leave-type" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Leave type
                </label>
                <select
                  id="away-leave-type"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                >
                  <option value="cl">Casual Leave</option>
                  <option value="sl">Sick Leave</option>
                  <option value="el">Earned Leave</option>
                  <option value="fl">Flexible Leave</option>
                  <option value="ml">Maternity Leave</option>
                </select>
                {leaveType === "cl" && (
                  <label className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={halfDay}
                      onChange={(e) => setHalfDay(e.target.checked)}
                      className="size-4 rounded border-input accent-foreground"
                    />
                    Half day (single day only)
                  </label>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="away-start" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  From
                </label>
                <input
                  id="away-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent-foreground/50 focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label htmlFor="away-end" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  To
                </label>
                <input
                  id="away-end"
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent-foreground/50 focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            {auth.signedIn || rememberedEmail ? (
              <p className="mt-4 rounded-lg bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                Requesting as <span className="font-medium text-foreground">{auth.name ?? rememberedEmail}</span>
                {auth.signedIn && <span className="text-xs"> ({auth.email})</span>}
              </p>
            ) : (
              <div className="mt-4">
                <Input
                  label="Email for this request"
                  type="email"
                  required
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    setError(false);
                  }}
                  placeholder="you@innovinlabs.com"
                  leftIcon={<Mail className="size-4" />}
                  autoComplete="email"
                />
              </div>
            )}

            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Reason (optional)"
              aria-label="Reason"
              className="mt-4 resize-none"
              rows={3}
            />

            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}

            <StatefulButton
              type="submit"
              state={buttonState}
              loadingText="Sending request"
              successText="Request sent"
              errorText="Try again"
              icon={<Send className="size-4" />}
              className="mt-5 h-11 w-full rounded-lg font-medium"
            >
              Request {type === "leave" ? "Leave" : "WFH"}
            </StatefulButton>
          </form>
        </Card>
      )}

      <Card className="mt-4 gap-0 p-5">
        <h2 className="eyebrow">Your requests</h2>
        {focusRequest && requests && !requests.some(r=>r.id===focusRequest) && <p role="status" className="studio-notice">This request is not in your recent history. Ask the coordinator to check it.</p>}
        {!requests ? (<LoadRecovery>
          <div className="mt-3 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </LoadRecovery>) : requests.length === 0 ? (
          <Empty>No requests yet — approved time away shows up here.</Empty>
        ) : (
          <ul className="mt-1 divide-y">
            {requests.map((r, i) => (
              <li key={r.id} id={`request-${r.id}`} className="flex items-center gap-3 py-3.5" style={stagger(i)}>
                <IconTile icon={r.type === "leave" ? Palmtree : CalendarOff} tone={r.type === "leave" ? "amber" : "sky"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{AWAY_TYPE_LABEL[r.type]}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateRange(r.startDate, r.endDate)} • sent {relativeTime(r.createdAt)}
                  </p>
                  {r.reason && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.reason}</p>}
                </div>
                {/* Plans change: pending or approved requests can be pulled back until the day
                    itself. Zoho reconciliation remains separate from cancellation here. */}
                {(r.status === "pending" || r.status === "approved") && r.endDate >= todayIST() ? (
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <AnimatedBadge status={AWAY_META[r.status].badge} size="sm" contentKey={r.status}>
                      {AWAY_META[r.status].label}
                    </AnimatedBadge>
                    <button
                      type="button"
                      disabled={cancelling === r.id}
                      onClick={() => cancelRequest(r.id)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      {cancelling === r.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                ) : (
                  <AnimatedBadge status={AWAY_META[r.status].badge} size="sm" contentKey={r.status} className="shrink-0">
                    {AWAY_META[r.status].label}
                  </AnimatedBadge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
