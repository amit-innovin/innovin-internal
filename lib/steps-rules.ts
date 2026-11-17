// The 10K steps screen's chart (prototype: docs/design/m3/, Steps). Pure.
import { addDays } from "./office-days";

// The last 7 days ending today, oldest first; a day with nothing logged is 0.
export function sevenDays(rows: { date: string; steps: number }[], today: string): { date: string; steps: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, steps: rows.filter((r) => r.date === date).reduce((n, r) => n + r.steps, 0) };
  });
}
