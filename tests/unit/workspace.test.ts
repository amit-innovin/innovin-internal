import { describe, expect, it } from "vitest";
import { activeMode, arenaRankings, validPlannerDate } from "@/lib/workspace-model";

describe("workspace rules", () => {
  it("unlocks office presence only for a current declaration and active attendance", () => {
    const profile = { mode: "office" as const, presenceDate: "2026-10-15" };
    expect(activeMode(profile, true, "2026-10-15")).toBe("office");
    expect(activeMode(profile, false, "2026-10-15")).toBeNull();
    expect(activeMode(profile, true, "2026-10-16")).toBeNull();
    expect(activeMode(null, true, "2026-10-15")).toBeNull();
  });
  it("rejects impossible and malformed planner dates", () => {
    expect(validPlannerDate("2026-02-29")).toBe(false);
    expect(validPlannerDate("2028-02-29")).toBe(true);
    expect(validPlannerDate("2026-10-15-extra")).toBe(false);
  });
  it("ranks actual weekly logs and does not invent counts for hit-only entries", () => {
    const people = [{ email: "a", name: "A", department: "Design" }, { email: "b", name: "B", department: "Design" }];
    const logs = [
      { email: "a", date: "2026-10-12", steps: 12000, hit: true },
      { email: "a", date: "2026-10-13", steps: null, hit: true },
      { email: "b", date: "2026-10-11", steps: 50000, hit: true },
      { email: "b", date: "2026-10-15", steps: 5000, hit: false },
    ];
    const ranks = arenaRankings(people, logs, "2026-10-15");
    expect(ranks.week.map((r) => r.score)).toEqual([12000, 5000]);
    expect(ranks.days[0].score).toBe(2);
    expect(ranks.record[0].score).toBe(50000);
    expect(ranks.departments[0].score).toBe(8500);
  });
});
