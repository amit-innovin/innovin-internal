// Leave policy engine — Employee Leave Policy 3.0 (Ref InnoAI/TVM/Circular/26001,
// effective 1 Jul 2026). Pure date/number math so it can be unit-tested without a store.
//
//   Type            Days/yr   Carry forward   Encashable
//   Casual (CL)     4         no              no            half-day allowed, max 3 consecutive
//   Sick (SL)       6         no              no            >3 consecutive may need a certificate
//   Earned (EL)     15        up to 15        on separation  1.25/completed month, usable after 1 yr
//   Flexible (FL)   2         no              no            pro-rata for mid-year joiners
//   Maternity (ML)  26 weeks  n/a             n/a           tracked, not balance-counted here
//
// Leave year is the calendar year. CL/SL/FL lapse at year end.

export type LeaveType = "cl" | "sl" | "el" | "fl" | "ml";

export const LEAVE_TYPES: LeaveType[] = ["cl", "sl", "el", "fl", "ml"];

export const LEAVE_LABELS: Record<LeaveType, string> = {
  cl: "Casual",
  sl: "Sick",
  el: "Earned",
  fl: "Flexible",
  ml: "Maternity",
};

export const isLeaveType = (v: unknown): v is LeaveType => LEAVE_TYPES.includes(v as LeaveType);

// Leave is tracked in half days — render 2 rather than 2.0, but keep the .5 when there is one.
export const fmtLeaveDays = (n: number) => `${Number(n.toFixed(1))}`;

// Company-declared holidays per leave year, from the annual calendar.
const HOLIDAYS: Record<number, Record<string, string>> = {
  2026: {
    "2026-01-26": "Republic Day",
    "2026-03-20": "Ramzan",
    "2026-04-15": "Vishu",
    "2026-05-01": "May Day",
    "2026-08-15": "Independence Day",
    "2026-08-26": "Onam",
    "2026-10-02": "Gandhi Jayanthi",
    "2026-10-20": "Mahanavami",
    "2026-12-25": "Christmas",
  },
};

export const holidaysFor = (year: number): Record<string, string> => HOLIDAYS[year] ?? {};

// Dates are plain YYYY-MM-DD; parse as UTC so the result never shifts with the server's zone.
const parseDay = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

// Which Saturday of the month this is (1st, 2nd, …).
const saturdayOrdinal = (d: Date) => Math.ceil(d.getUTCDate() / 7);

// A working day is any scheduled day: the week is 6 days (Sunday off), with the 2nd and 4th
// Saturday also off, minus company-declared holidays. Verified against the "total working
// days" figures on each month sheet of the 2026 tracker.
export function isWorkingDay(iso: string) {
  const d = parseDay(iso);
  const weekday = d.getUTCDay();
  if (weekday === 0) return false;
  if (weekday === 6 && (saturdayOrdinal(d) === 2 || saturdayOrdinal(d) === 4)) return false;
  return !holidaysFor(d.getUTCFullYear())[iso];
}

export function nonWorkingReason(iso: string): string | null {
  const d = parseDay(iso);
  const holiday = holidaysFor(d.getUTCFullYear())[iso];
  if (holiday) return holiday;
  if (d.getUTCDay() === 0) return "Sunday";
  if (d.getUTCDay() === 6 && (saturdayOrdinal(d) === 2 || saturdayOrdinal(d) === 4)) {
    return `${saturdayOrdinal(d) === 2 ? "2nd" : "4th"} Saturday`;
  }
  return null;
}

// Working days a leave range consumes. Sundays, 2nd/4th Saturdays and holidays inside the
// range are free — so 20 Mar 2026 (Ramzan) costs nothing.
export function leaveWorkingDays(startDate: string, endDate: string) {
  if (endDate < startDate) return 0;
  let days = 0;
  for (const d = parseDay(startDate), end = parseDay(endDate); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isWorkingDay(toIso(d))) days += 1;
  }
  return days;
}

// Working days inclusive, or 0.5 for a half-day (single-day Casual Leave only).
export function leaveCost(startDate: string, endDate: string, halfDay = false) {
  if (halfDay) return startDate === endDate && isWorkingDay(startDate) ? 0.5 : 0;
  return leaveWorkingDays(startDate, endDate);
}

export function workingDaysInMonth(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let days = 0;
  for (let day = 1; day <= last; day += 1) {
    if (isWorkingDay(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)) days += 1;
  }
  return days;
}

// Entitlement for anyone without an imported per-person figure — the current policy.
// Existing staff were tracked on the pre-July Casual Leave figure (8), which is preserved
// per person in data/leave-2026.json rather than encoded as a rule here.
export const POLICY_ENTITLEMENT: Record<"cl" | "sl" | "el" | "fl", number> = { cl: 4, sl: 6, el: 15, fl: 2 };

export const EL_ACCRUAL_PER_MONTH = 1.25;
export const EL_CARRY_FORWARD_CAP = 15;
export const EL_ELIGIBLE_AFTER_MONTHS = 12;

// Completed calendar months of continuous service.
export function completedMonths(joinedOn: string, asOf: string) {
  const from = parseDay(joinedOn);
  const to = parseDay(asOf);
  if (to < from) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1; // the current month isn't complete yet
  return Math.max(0, months);
}

// Earned Leave accrues from the joining date at 1.25 days per completed month.
export const earnedAccrued = (joinedOn: string, asOf: string) =>
  round(completedMonths(joinedOn, asOf) * EL_ACCRUAL_PER_MONTH);

// Accrued Earned Leave shows in the balance but can't be availed in the first year.
export const canAvailEarned = (joinedOn: string, asOf: string) =>
  completedMonths(joinedOn, asOf) >= EL_ELIGIBLE_AFTER_MONTHS;

// Flexible Leave is pro-rata for mid-year joiners, by remaining whole months in the year.
export function flexibleEntitlement(joinedOn: string | null, year: number, full = POLICY_ENTITLEMENT.fl) {
  if (!joinedOn || Number(joinedOn.slice(0, 4)) < year) return full;
  if (Number(joinedOn.slice(0, 4)) > year) return 0;
  const monthsLeft = 12 - Number(joinedOn.slice(5, 7)) + 1;
  return round((full * monthsLeft) / 12, 0.5);
}

// Money-free rounding: leave is tracked in half days.
export function round(n: number, step = 0.01) {
  return Math.round(n / step) * step;
}

export type LeaveLedger = { type: LeaveType; entitled: number; used: number; pending: number; remaining: number };

// Balances for one person in one leave year. `opening` carries days already taken outside the
// app (imported from the tracker); `requests` are this year's rows recorded by the app.
export function leaveLedger(input: {
  entitlement: Partial<Record<LeaveType, number>>;
  opening?: Partial<Record<LeaveType, number>>;
  requests: { type: LeaveType; days: number; status: "pending" | "approved" | "rejected" }[];
}): LeaveLedger[] {
  return LEAVE_TYPES.filter((t) => t !== "ml").map((type) => {
    const entitled = input.entitlement[type] ?? 0;
    const rows = input.requests.filter((r) => r.type === type);
    const used = round((input.opening?.[type] ?? 0) + sum(rows.filter((r) => r.status === "approved")));
    const pending = round(sum(rows.filter((r) => r.status === "pending")));
    return { type, entitled, used, pending, remaining: round(entitled - used) };
  });
}

const sum = (rows: { days: number }[]) => rows.reduce((n, r) => n + r.days, 0);
