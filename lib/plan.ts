// Which future days someone plans to come in: their usual weekdays, with single dates added or
// taken out on top. Pure, so Days, Home and the "expected" counts agree.
import type { DaysView } from "./days";
import { weekdayIndex } from "./office-days";

export function isPlanned(input: { date: string; today: string; officeDays: number[]; override: boolean | undefined; working: boolean; leave: boolean }): boolean {
  if (input.date <= input.today || !input.working || input.leave) return false;
  return input.override ?? input.officeDays.includes(weekdayIndex(input.date));
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
