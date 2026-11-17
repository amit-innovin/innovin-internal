// Which future days someone plans to come in: their usual weekdays, with single dates added or
// taken out on top. Pure, so Days, Home and the "expected" counts agree.
import type { DaysView } from "./days";
import { weekdayIndex } from "./office-days";

type PlanInput = { date: string; officeDays: number[]; override: boolean | undefined; working: boolean; leave: boolean };

// Whether a date is one you plan to be in, ignoring whether it's past: Home asks this about today.
export function plannedOn(input: PlanInput): boolean {
  if (!input.working || input.leave) return false;
  return input.override ?? input.officeDays.includes(weekdayIndex(input.date));
}

// A future day you plan to come in. Today and the past are never "planned".
export function isPlanned(input: PlanInput & { today: string }): boolean {
  return input.date > input.today && plannedOn(input);
}

// The next planned days after today, in date order; `usual` when it's one of the weekly days.
export function comingUp(view: DaysView, limit = 6): { date: string; usual: boolean }[] {
  return view.days.filter((d) => d.date > view.today && d.planned).slice(0, limit).map((d) => ({ date: d.date, usual: !d.added }));
}

// "2026-11" plus n months, as "YYYY-MM".
export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// How far ahead single days can be planned, in calendar months after the current one.
export const PLAN_MONTHS_AHEAD = 2;
