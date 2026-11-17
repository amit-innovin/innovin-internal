// Pure rules behind Home's "This week" card and the office-day verdict (prototype: docs/design/m3/).
// The verdict is information, never a score: green when the plan meets the rule, amber only when
// you need to act, and no red, because this is a mandate.
import type { DaysView } from "./days";
import { addDays, weekdayIndex } from "./office-days";

export type PaceState = "done" | "track" | "short" | "none";
export type Pace = { state: PaceState; short: string; long: string; tone: "success" | "warn" | "neutral" };

const monthName = (month: string) => new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function paceVerdict(input: { done: number; planned: number; target: number | null; month: string }): Pace {
  const { done, planned, target, month } = input;
  if (!target) return { state: "none", short: "No office days needed", long: "No office days needed this month", tone: "neutral" };
  if (done >= target) return { state: "done", short: `Done for ${monthName(month)}`, long: `Done: ${target} of ${target} office days`, tone: "success" };
  const spare = done + planned - target;
  if (spare >= 0) {
    return spare === 0
      ? { state: "track", short: "On track", long: "On track. Every planned day counts", tone: "success" }
      : { state: "track", short: `On track · ${spare} spare`, long: `On track, with ${spare} spare ${spare === 1 ? "day" : "days"}`, tone: "success" };
  }
  return { state: "short", short: `Plan ${-spare} more`, long: `Plan ${-spare} more ${-spare === 1 ? "day" : "days"} to reach ${target}`, tone: "warn" };
}

const countsToday = (view: DaysView) => view.me === null && view.isOfficeDayToday;

// Future days already planned, plus today while it's still open and one of your office days.
export function plannedCount(view: DaysView): number {
  return view.days.filter((d) => d.date > view.today && d.planned).length + (countsToday(view) ? 1 : 0);
}

export type WeekDay = { date: string; label: string; day: number; state: "done" | "planned" | "empty" | "leave" | "off"; today: boolean };
const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Monday to Friday of the week that contains today.
export function weekStrip(view: DaysView): WeekDay[] {
  const monday = addDays(view.today, -weekdayIndex(view.today));
  return LABELS.map((label, i) => {
    const date = addDays(monday, i);
    const row = view.days.find((d) => d.date === date);
    const today = date === view.today;
    const state: WeekDay["state"] = row?.mode === "office" ? "done"
      : row?.leave ? "leave"
      : row && !row.working ? "off"
      : row?.planned || (today && countsToday(view)) ? "planned"
      : "empty";
    return { date, label: today ? "Today" : label, day: Number(date.slice(8)), state, today };
  });
}

export type TimeOfDay = "morning" | "afternoon" | "evening";

// Indian time, whatever the device clock's zone is. Late night (before 5:00) still counts as evening.
export function timeOfDayIST(now: Date): TimeOfDay {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 5 ? "evening" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}
