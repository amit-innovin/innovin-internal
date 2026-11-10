// The office-day rules: everyone owes 8 office days a month, on their own regular weekdays.
// Pure functions, so Home, Days and the admin table all agree.
import { isWorkingDay, leaveWorkingDays, workingDaysInMonth } from "./leave";
import type { AttendanceRow, EmployeeRow } from "./types";

export const OFFICE_DAY_TARGET = 8;
// Members can fix their own days this far back; anything older needs an admin.
export const SELF_FIX_DAYS = 7;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Monday = 0 … Sunday = 6, the order the weekday chips are drawn in.
export const weekdayIndex = (date: string) => (parse(date).getUTCDay() + 6) % 7;

export function addDays(date: string, days: number) {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export function monthBounds(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return { first: `${month}-01`, last: `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, "0")}` };
}

export const fixableFrom = (today: string) => addDays(today, -SELF_FIX_DAYS);

// A day counts once, however it was marked. Leave does not count and does not lower the target.
export const countOfficeDays = (rows: Pick<AttendanceRow, "date" | "declaredMode">[]) => new Set(rows.filter((r) => r.declaredMode === "office").map((r) => r.date)).size;

// null = exempt (no target). Someone who joins mid-month owes a share of the 8, never zero.
export function officeDayTarget(person: Pick<EmployeeRow, "joinedOn" | "officeExempt">, month: string): number | null {
  if (person.officeExempt) return null;
  const { first, last } = monthBounds(month);
  if (!person.joinedOn || person.joinedOn <= first) return OFFICE_DAY_TARGET;
  if (person.joinedOn > last) return 0;
  const [year, mon] = month.split("-").map(Number);
  const share = leaveWorkingDays(person.joinedOn, last) / workingDaysInMonth(year, mon);
  return Math.max(1, Math.round(OFFICE_DAY_TARGET * share));
}

export type OfficeDayStatus = "on-track" | "behind" | "done" | "exempt";

// "Behind" means fewer office days than the month's pace so far (working days already over,
// not counting today, since today can still be marked).
export function officeDaysSummary(input: { done: number; target: number | null; month: string; today: string }) {
  const { first, last } = monthBounds(input.month);
  if (input.target === null) return { done: input.done, target: null, toGo: 0, status: "exempt" as OfficeDayStatus, lastDay: last };
  const toGo = Math.max(0, input.target - input.done);
  const [year, mon] = input.month.split("-").map(Number);
  const overUntil = input.today > last ? last : addDays(input.today, -1);
  const elapsed = overUntil < first ? 0 : leaveWorkingDays(first, overUntil);
  const pace = Math.floor((input.target * elapsed) / workingDaysInMonth(year, mon));
  const status: OfficeDayStatus = toGo === 0 ? "done" : input.done < pace ? "behind" : "on-track";
  return { done: input.done, target: input.target, toGo, status, lastDay: last };
}

// Expected in the office: one of their regular weekdays, and the office is open that day.
export const expectedOn = (officeDays: number[], date: string) => officeDays.includes(weekdayIndex(date)) && isWorkingDay(date);

export const scheduleLabel = (officeDays: number[]) => (officeDays.length ? [...officeDays].sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join(" + ") : "Not set");

export const validOfficeDays = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length <= 7 && value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && new Set(value).size === value.length;
