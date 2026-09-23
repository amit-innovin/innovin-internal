import seed from "@/data/leave-2026.json";
import {
  canAvailEarned,
  earnedAccrued,
  flexibleEntitlement,
  holidaysFor,
  leaveLedger,
  POLICY_ENTITLEMENT,
  type LeaveLedger,
  type LeaveType,
} from "./leave";
import { store } from "./store";
import type { AwayRow, EmployeeRow } from "./types";

// Balances and usage carried over from the spreadsheet the team kept before this app existed
// (data/leave-2026.json). Matched on the employee's Google display name, since the sheet has
// no emails. Anyone it can't match falls back to the current policy entitlement.
const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();
const IMPORTED = new Map(seed.people.map((p) => [normalize(p.name), p]));

type Imported = (typeof seed.people)[number];

export const importedFor = (name: string | undefined): Imported | undefined =>
  name ? IMPORTED.get(normalize(name)) : undefined;

export type LeaveSummary = {
  year: number;
  joinedOn: string | null;
  imported: boolean;
  ledger: LeaveLedger[];
  earned: { accrued: number | null; canAvail: boolean; note: string | null };
  holidays: { date: string; name: string }[];
};

// Entitlement per type: the imported per-person figure wins for the imported year, because
// existing staff were tracked on the pre-July Casual Leave allowance. Everyone else gets the
// current policy, with Flexible Leave pro-rated for mid-year joiners.
export function entitlementFor(employee: Pick<EmployeeRow, "name" | "joinedOn">, year: number) {
  const imported = year === seed.year ? importedFor(employee.name) : undefined;
  const ent = imported?.entitlement as Partial<Record<LeaveType, number>> | undefined;
  return {
    cl: ent?.cl ?? POLICY_ENTITLEMENT.cl,
    sl: ent?.sl ?? POLICY_ENTITLEMENT.sl,
    fl: ent?.fl ?? flexibleEntitlement(employee.joinedOn, year),
    // Earned Leave is a running balance, not an annual grant: prefer the imported balance,
    // else accrue from the joining date. Unknown joining date means we can't compute it.
    el: imported?.earnedBalance ?? (employee.joinedOn ? earnedAccrued(employee.joinedOn, `${year}-12-31`) : 0),
  };
}

export function summarize(employee: Pick<EmployeeRow, "name" | "joinedOn">, rows: AwayRow[], year: number, today: string): LeaveSummary {
  const imported = year === seed.year ? importedFor(employee.name) : undefined;
  const requests = rows
    .filter((r) => r.type === "leave" && r.leaveType && r.startDate.startsWith(String(year)))
    .map((r) => ({ type: r.leaveType as LeaveType, days: r.days, status: r.status }));

  const ledger = leaveLedger({
    entitlement: entitlementFor(employee, year),
    opening: imported?.used as Partial<Record<LeaveType, number>> | undefined,
    requests,
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
    imported: !!imported,
    ledger,
    earned,
    holidays: Object.entries(holidaysFor(year))
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// Everyone's usage for the admin overview, including people who haven't signed in yet (they
// exist only in the imported sheet, so they're listed with their imported numbers).
export async function leaveOverview(year: number, today: string) {
  const [employees, away] = await Promise.all([store.listEmployees(), store.listAway(500)]);
  const byEmail = new Map<string, AwayRow[]>();
  for (const row of away) byEmail.set(row.email, [...(byEmail.get(row.email) ?? []), row]);

  const signedIn = employees.map((e) => ({
    name: e.name || e.email,
    email: e.email,
    joinedOn: e.joinedOn,
    summary: summarize(e, byEmail.get(e.email) ?? [], year, today),
  }));

  const claimed = new Set(employees.map((e) => normalize(e.name || "")));
  const unmatched = seed.people
    .filter((p) => !claimed.has(normalize(p.name)))
    .map((p) => ({
      name: p.name,
      email: null,
      joinedOn: null,
      summary: summarize({ name: p.name, joinedOn: null }, [], year, today),
    }));

  return { signedIn, unmatched };
}
