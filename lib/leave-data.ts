import {
  canAvailEarned,
  earnedAccrued,
  flexibleEntitlement,
  holidaysFor,
  leaveLedger,
  POLICY_ENTITLEMENT,
  round,
  type LeaveLedger,
  type LeaveType,
} from "./leave";
import { store } from "./store";
import type { AwayRow, EmployeeRow, LeaveBalanceRow } from "./types";

// Zoho People is the system of record for leave. This app holds a snapshot an admin copies in
// (lib/types LeaveBalanceRow) plus whatever has been requested here since that snapshot, so the
// two never silently disagree: every balance is labelled with the date it was taken from Zoho.
//
// An earlier version imported a spreadsheet of per-person entitlements. It was dropped because
// it disagreed with Zoho on three of four leave types — including a Casual Leave allowance of 8
// where the signed policy and Zoho both say 4.

export type LeaveSummary = {
  year: number;
  joinedOn: string | null;
  // Where the numbers came from: an admin's Zoho snapshot, or just this app's own requests.
  source: "zoho-snapshot" | "app-only";
  asOf: string | null;
  ledger: LeaveLedger[];
  earned: { accrued: number | null; canAvail: boolean; note: string | null };
  holidays: { date: string; name: string }[];
};

const BALANCE_TYPES = ["cl", "sl", "el", "fl"] as const;

export function entitlementFor(employee: Pick<EmployeeRow, "joinedOn">, year: number) {
  return {
    cl: POLICY_ENTITLEMENT.cl,
    sl: POLICY_ENTITLEMENT.sl,
    el: POLICY_ENTITLEMENT.el,
    fl: flexibleEntitlement(employee.joinedOn, year),
  };
}

export function summarize(
  employee: Pick<EmployeeRow, "name" | "joinedOn">,
  rows: AwayRow[],
  year: number,
  today: string,
  balance?: LeaveBalanceRow,
): LeaveSummary {
  // Only requests made *after* the snapshot count on top of it — anything earlier is already
  // reflected in the Zoho figure the admin copied.
  const requests = rows
    .filter((r) => r.type === "leave" && r.leaveType && r.startDate.startsWith(String(year)))
    .filter((r) => !balance || r.createdAt > balance.asOf)
    .map((r) => ({ type: r.leaveType as LeaveType, days: r.days, status: r.status }));

  const entitlement = entitlementFor(employee, year);
  const ledger = leaveLedger({ entitlement, requests }).map((row) => {
    const snapshot = balance?.available[row.type as (typeof BALANCE_TYPES)[number]];
    if (snapshot === undefined) return row;
    // Treat the snapshot as the truth and take this app's approvals off it. Earned Leave can
    // exceed the annual grant through carry-forward, so entitled tracks the snapshot upward.
    const remaining = round(snapshot - row.used);
    return { ...row, entitled: Math.max(row.entitled, round(snapshot + row.used)), remaining };
  });

  const joinedOn = employee.joinedOn;
  const earned = joinedOn
    ? {
        accrued: earnedAccrued(joinedOn, today),
        canAvail: canAvailEarned(joinedOn, today),
        note: canAvailEarned(joinedOn, today) ? null : "Earned Leave can be availed after one year of service.",
      }
    : { accrued: null, canAvail: false, note: "Ask an admin to add your joining date to track Earned Leave." };

  return {
    year,
    joinedOn,
    source: balance ? "zoho-snapshot" : "app-only",
    asOf: balance?.asOf ?? null,
    ledger,
    earned,
    holidays: Object.entries(holidaysFor(year))
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// Everyone's balances for the admin overview.
export async function leaveOverview(year: number, today: string) {
  const [employees, away, balances] = await Promise.all([
    store.listEmployees(),
    store.listAway(500),
    store.listLeaveBalances(year),
  ]);
  const byEmail = new Map<string, AwayRow[]>();
  for (const row of away) byEmail.set(row.email, [...(byEmail.get(row.email) ?? []), row]);
  const balanceFor = new Map(balances.map((b) => [b.email, b]));

  return {
    people: employees.map((e) => ({
      name: e.name || e.email,
      email: e.email,
      joinedOn: e.joinedOn,
      summary: summarize(e, byEmail.get(e.email) ?? [], year, today, balanceFor.get(e.email)),
    })),
  };
}
