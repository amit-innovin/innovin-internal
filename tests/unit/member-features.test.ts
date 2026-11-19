import { describe, expect, it } from "vitest";
import { celebrationsFor, pollResults, stepLeague, weekStart } from "@/lib/member-features";
import type { EmployeeRow, StepsRow } from "@/lib/types";

const person = (email: string, p: Partial<EmployeeRow> = {}): EmployeeRow => ({ email, name: email.split("@")[0], picture: "", role: "member", joinedOn: null, stepsOffset: 0, officeDays: [], officeExempt: false, birthday: null, showBirthday: false, createdAt: "", lastSeenAt: "", stepsLeague: true, ...p });
const steps = (email: string, date: string, n: number | null, hit = (n ?? 0) >= 10_000): StepsRow => ({ id: `${email}${date}`, email, date, hit, steps: n, createdAt: "" });

describe("step league", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-11")).toBe("2026-11-09");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
  });

  it("lists only people who joined the league", () => {
    const today = "2026-11-11";
    const rows = [steps("a@x.com", today, 9000), steps("b@x.com", today, 12000)];
    const league = stepLeague([person("a@x.com"), person("b@x.com", { stepsLeague: false })], rows, today, "a@x.com");
    expect(league.week.map((r) => r.email)).toEqual(["a@x.com"]);
    expect(league.today.map((r) => r.email)).toEqual(["a@x.com"]);
    expect(league.nudge.week).toBeNull();
  });

  it("ranks this week's and today's step totals, and says how far to pass the next person", () => {
    const today = "2026-11-11";
    const rows = [
      steps("a@x.com", "2026-11-09", 9000), steps("a@x.com", "2026-11-11", 4000),
      steps("b@x.com", "2026-11-10", 12000),
      steps("c@x.com", "2026-11-11", 6000),
      steps("c@x.com", "2026-11-08", 50000), // last week: not counted
      steps("d@x.com", "2026-11-11", null, true), // a 10K tick with no count
    ];
    const league = stepLeague([person("a@x.com"), person("b@x.com"), person("c@x.com"), person("d@x.com")], rows, today, "c@x.com");
    expect(league.week.map((r) => [r.email, r.steps])).toEqual([["a@x.com", 13000], ["b@x.com", 12000], ["c@x.com", 6000], ["d@x.com", 10000]].sort((x, y) => (y[1] as number) - (x[1] as number)));
    expect(league.today.map((r) => r.email)).toEqual(["d@x.com", "c@x.com", "a@x.com"]);
    // The viewer is 3rd this week (behind d's counted 10,000); passing d takes 4,001 more.
    expect(league.nudge.week).toEqual({ name: "d", steps: 4001 });
    expect(league.me).toMatchObject({ todaySteps: 6000 });
  });
});

describe("polls", () => {
  it("counts votes per option, rounds to whole percentages, and marks the viewer's pick", () => {
    const result = pollResults(["Biryani", "Pizza", "Sadya"], [{ email: "a", option: 0 }, { email: "b", option: 0 }, { email: "c", option: 1 }], "c");
    expect(result.total).toBe(3);
    expect(result.options).toEqual([
      { label: "Biryani", votes: 2, pct: 67, mine: false },
      { label: "Pizza", votes: 1, pct: 33, mine: true },
      { label: "Sadya", votes: 0, pct: 0, mine: false },
    ]);
    expect(pollResults(["A", "B"], [], "x").options.every((o) => o.pct === 0)).toBe(true);
  });
});

describe("celebrations", () => {
  it("shows opted-in birthdays and work anniversaries in the coming week, soonest first", () => {
    const people = [
      person("ravi@x.com", { name: "Ravi", birthday: "11-11", showBirthday: true }),
      person("hidden@x.com", { name: "Hidden", birthday: "11-12", showBirthday: false }),
      person("ananya@x.com", { name: "Ananya", joinedOn: "2023-11-13" }),
      person("new@x.com", { name: "New", joinedOn: "2026-11-12" }), // joining day itself, not an anniversary
      person("far@x.com", { name: "Far", birthday: "12-25", showBirthday: true }),
    ];
    const list = celebrationsFor(people, "2026-11-11");
    expect(list.map((c) => [c.name, c.type, c.date, c.today])).toEqual([
      ["Ravi", "birthday", "2026-11-11", true],
      ["Ananya", "anniversary", "2026-11-13", false],
    ]);
    expect(list[1].years).toBe(3);
  });

  it("wraps across the new year", () => {
    const list = celebrationsFor([person("a@x.com", { name: "A", birthday: "01-02", showBirthday: true })], "2026-12-30");
    expect(list[0]).toMatchObject({ date: "2027-01-02" });
  });
});
