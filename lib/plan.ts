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
