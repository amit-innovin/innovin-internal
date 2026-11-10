import type { WorkspaceProfile } from "./types";


export function activeMode(profile: Pick<WorkspaceProfile, "mode" | "presenceDate"> | null, checkedIn: boolean, today: string) {
  return checkedIn && profile?.presenceDate === today ? profile.mode : null;
}

export type Ranking = { id: string; name: string; score: number; unit: string };
export function arenaRankings(
  people: { email: string; name: string; department: string; stepsOffset?: number }[],
  logs: { email: string; date: string; steps: number | null; hit: boolean }[], today: string,
) {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const monday = start.toISOString().slice(0, 10);
  const week: Ranking[] = [], days: Ranking[] = [], record: Ranking[] = [];
  const departments = new Map<string, { total: number; members: Set<string> }>();
  for (const p of people) {
    const mine = logs.filter((r) => r.email === p.email && r.date <= today);
    const recent = mine.filter((r) => r.date >= monday);
    const counts = recent.filter((r) => r.steps !== null);
    const sum = counts.reduce((n, r) => n + r.steps!, 0);
    if (counts.length) week.push({ id: p.email, name: p.name, score: sum, unit: "steps this week" });
    const hits = mine.filter((r) => r.hit).length + (p.stepsOffset ?? 0);
    if (hits) days.push({ id: p.email, name: p.name, score: hits, unit: p.stepsOffset ? "10k+ days · includes admin sheet total" : "10k+ days logged" });
    const allCounts = mine.flatMap((r) => r.steps === null ? [] : [r.steps]);
    if (allCounts.length) record.push({ id: p.email, name: p.name, score: Math.max(...allCounts), unit: "steps in one day" });
    if (p.department && counts.length) {
      const d = departments.get(p.department) ?? { total: 0, members: new Set<string>() };
      d.total += sum; d.members.add(p.email); departments.set(p.department, d);
    }
  }
  const sort = (rows: Ranking[]) => rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { week: sort(week), days: sort(days), record: sort(record), departments: sort([...departments].map(([name, d]) => ({ id: name, name, score: Math.round(d.total / d.members.size), unit: `avg steps · ${d.members.size} logging` }))) };
}
