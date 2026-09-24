import type { EmployeeRow, StepsRow } from "./types";

export const STEP_GOAL = 10_000;

const dayBefore = (date: string, n = 1) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

// Consecutive hit-days ending today — or yesterday, so a streak survives until tonight's walk.
export function stepStreak(hitDates: Iterable<string>, today: string) {
  const hits = new Set(hitDates);
  let cursor = hits.has(today) ? today : dayBefore(today);
  if (!hits.has(cursor)) return 0;
  let n = 0;
  while (hits.has(cursor)) {
    n++;
    cursor = dayBefore(cursor);
  }
  return n;
}

export type BoardEntry = {
  email: string;
  name: string;
  days: number;
  streak: number;
  // Today's log, for the "in today" marker on the board.
  todayHit: boolean;
  todaySteps: number | null;
};

// The leaderboard: app-logged hit-days plus each person's admin-entered sheet offset.
// Only people with something to show appear — nobody's on the board at zero.
export function stepBoard(employees: EmployeeRow[], rows: StepsRow[], today: string): BoardEntry[] {
  const byEmail = new Map<string, StepsRow[]>();
  for (const r of rows) byEmail.set(r.email, [...(byEmail.get(r.email) ?? []), r]);

  return employees
    .map((e) => {
      const mine = byEmail.get(e.email) ?? [];
      const hitDays = mine.filter((r) => r.hit).map((r) => r.date);
      const days = e.stepsOffset + hitDays.length;
      const todayRow = mine.find((r) => r.date === today);
      return {
        email: e.email,
        name: e.name || e.email,
        days,
        streak: stepStreak(hitDays, today),
        todayHit: todayRow?.hit ?? false,
        todaySteps: todayRow?.steps ?? null,
        logged: mine.length > 0,
      };
    })
    .filter((b) => b.days > 0 || b.logged)
    .map(({ logged: _, ...b }) => b)
    .sort((a, b) => b.days - a.days || b.streak - a.streak || a.name.localeCompare(b.name));
}
