// Pure rules for the member app's social features: the step league, poll results and
// celebrations. Server routes read the store and pass rows in.
import { STEP_GOAL, stepStreak } from "./steps";
import type { EmployeeRow, StepsRow } from "./types";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const shift = (iso: string, days: number) => { const d = day(iso); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const firstName = (e: Pick<EmployeeRow, "name" | "email">) => (e.name.trim() || e.email.split("@")[0]).split(/\s+/)[0];

export const weekStart = (today: string) => shift(today, -((day(today).getUTCDay() + 6) % 7));

// A 10K tick without a count still counts as 10,000 steps, so ticking never ranks below zero.
const counted = (r: StepsRow) => r.steps ?? (r.hit ? STEP_GOAL : 0);

export type LeagueRow = { email: string; name: string; steps: number; streak: number; me: boolean };

export function stepLeague(employees: EmployeeRow[], rows: StepsRow[], today: string, viewer: string) {
  const from = weekStart(today);
  const byEmail = new Map(employees.map((e) => [e.email, e]));
  const table = (filter: (r: StepsRow) => boolean): LeagueRow[] => {
    const totals = new Map<string, number>();
    for (const r of rows) if (filter(r) && byEmail.has(r.email)) totals.set(r.email, (totals.get(r.email) ?? 0) + counted(r));
    return [...totals]
      .filter(([, n]) => n > 0)
      .map(([email, n]) => ({ email, name: firstName(byEmail.get(email)!), steps: n, streak: stepStreak(rows.filter((r) => r.email === email && r.hit).map((r) => r.date), today), me: email === viewer }))
      .sort((a, b) => b.steps - a.steps || a.name.localeCompare(b.name));
  };
  const week = table((r) => r.date >= from && r.date <= today);
  const todayTable = table((r) => r.date === today);
  const nudgeIn = (list: LeagueRow[]) => {
    const i = list.findIndex((r) => r.me);
    if (i <= 0) return null;
    return { name: list[i - 1].name, steps: list[i - 1].steps - list[i].steps + 1 };
  };
  const mine = rows.find((r) => r.email === viewer && r.date === today);
  return {
    weekFrom: from,
    week,
    today: todayTable,
    nudge: { week: nudgeIn(week), today: nudgeIn(todayTable) },
    me: { todaySteps: mine ? counted(mine) : 0, hit: mine?.hit ?? false, streak: stepStreak(rows.filter((r) => r.email === viewer && r.hit).map((r) => r.date), today) },
  };
}

export function pollResults(options: string[], votes: { email: string; option: number }[], viewer: string) {
  const total = votes.length;
  return {
    total,
    options: options.map((label, i) => {
      const n = votes.filter((v) => v.option === i).length;
      return { label, votes: n, pct: total ? Math.round((100 * n) / total) : 0, mine: votes.some((v) => v.email === viewer && v.option === i) };
    }),
  };
}

export type Celebration = { id: string; type: "birthday" | "anniversary"; email: string; name: string; date: string; today: boolean; years?: number };

// Birthdays (only for people who chose to show them) and work anniversaries in the next 7 days.
export function celebrationsFor(employees: EmployeeRow[], today: string, days = 7): Celebration[] {
  const year = Number(today.slice(0, 4));
  const next = (mmdd: string) => {
    const thisYear = `${year}-${mmdd}`;
    return thisYear >= today ? thisYear : `${year + 1}-${mmdd}`;
  };
  const until = shift(today, days - 1);
  const out: Celebration[] = [];
  for (const e of employees) {
    if (e.showBirthday && e.birthday && /^\d{2}-\d{2}$/.test(e.birthday)) {
      const date = next(e.birthday);
      if (date <= until) out.push({ id: `birthday-${e.email}-${date}`, type: "birthday", email: e.email, name: firstName(e), date, today: date === today });
    }
    if (e.joinedOn && /^\d{4}-\d{2}-\d{2}$/.test(e.joinedOn)) {
      const date = next(e.joinedOn.slice(5));
      const years = Number(date.slice(0, 4)) - Number(e.joinedOn.slice(0, 4));
      if (years >= 1 && date <= until) out.push({ id: `anniversary-${e.email}-${date}`, type: "anniversary", email: e.email, name: firstName(e), date, today: date === today, years });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
