import { describe, expect, it } from "vitest";
import type { DaysView } from "@/lib/days";
import { paceVerdict, plannedCount, timeOfDayIST, weekStrip } from "@/lib/pace";

describe("pace verdict", () => {
  it("done at 8 of 8", () =>
    expect(paceVerdict({ done: 8, planned: 0, target: 8, month: "2026-11" })).toEqual({ state: "done", short: "Done for November", long: "Done: 8 of 8 office days", tone: "success" }));
  it("exactly 8 with plans is on track, not tight", () =>
    expect(paceVerdict({ done: 5, planned: 3, target: 8, month: "2026-11" })).toMatchObject({ state: "track", short: "On track", long: "On track. Every planned day counts", tone: "success" }));
  it("spare days are counted", () =>
    expect(paceVerdict({ done: 5, planned: 4, target: 8, month: "2026-11" })).toMatchObject({ short: "On track · 1 spare", long: "On track, with 1 spare day" }));
  it("two spare days are plural", () =>
    expect(paceVerdict({ done: 5, planned: 5, target: 8, month: "2026-11" })).toMatchObject({ long: "On track, with 2 spare days" }));
  it("short asks for the missing days", () =>
    expect(paceVerdict({ done: 4, planned: 2, target: 8, month: "2026-11" })).toMatchObject({ state: "short", short: "Plan 2 more", long: "Plan 2 more days to reach 8", tone: "warn" }));
  it("one missing day is singular", () =>
    expect(paceVerdict({ done: 4, planned: 3, target: 8, month: "2026-11" })).toMatchObject({ long: "Plan 1 more day to reach 8" }));
  it("no target means nothing to plan", () =>
    expect(paceVerdict({ done: 0, planned: 0, target: 0, month: "2026-11" })).toMatchObject({ state: "none", short: "No office days needed", tone: "neutral" }));
  it("an exempt person (null target) has nothing to plan", () =>
    expect(paceVerdict({ done: 2, planned: 1, target: null, month: "2026-11" })).toMatchObject({ state: "none", short: "No office days needed" }));
});

describe("time of day in IST", () => {
  it("09:30 IST is morning", () => expect(timeOfDayIST(new Date("2026-11-16T04:00:00Z"))).toBe("morning"));
  it("14:00 IST is afternoon", () => expect(timeOfDayIST(new Date("2026-11-16T08:30:00Z"))).toBe("afternoon"));
  it("17:00 IST is evening", () => expect(timeOfDayIST(new Date("2026-11-16T11:30:00Z"))).toBe("evening"));
  it("midnight IST is evening", () => expect(timeOfDayIST(new Date("2026-11-16T18:30:00Z"))).toBe("evening"));
});

// Monday 16 Nov 2026: not marked yet, and Monday is one of this person's office days.
// Wednesday 18 is planned; Friday 13 was done last week (outside this week).
const day = (date: string, extra: Partial<DaysView["days"][number]> = {}) => ({ date, mode: null, late: false, working: true, off: null, planned: false, leave: null, fixable: false, ...extra }) as DaysView["days"][number];
function view(over: Partial<DaysView> = {}): DaysView {
  return {
    today: "2026-11-16",
    month: "2026-11",
    fixableFrom: "2026-11-09",
    officeDays: [0, 2],
    summary: { done: 5, target: 8 } as DaysView["summary"],
    me: null,
    isOfficeDayToday: true,
    days: [
      day("2026-11-13", { mode: "office" }),
      day("2026-11-16"),
      day("2026-11-17"),
      day("2026-11-18", { planned: true }),
      day("2026-11-19", { leave: "pending" }),
      day("2026-11-20", { working: false, off: "Holiday" }),
      day("2026-11-23", { planned: true }),
    ],
    around: { inToday: { count: 0, names: [] }, next: { date: "2026-11-17", count: 0, names: [], mine: false } },
    ...over,
  } as DaysView;
}

describe("planned days", () => {
  it("counts future planned days, plus today when not marked and it's an office day", () => expect(plannedCount(view())).toBe(3));
  it("does not count today once it's marked", () => expect(plannedCount(view({ me: { mode: "remote", source: "self", at: "2026-11-16T04:00:00Z" } }))).toBe(2));
  it("does not count today when it isn't an office day", () => expect(plannedCount(view({ isOfficeDayToday: false }))).toBe(2));
  it("does not count planned days you are on leave", () =>
    expect(plannedCount(view({ days: [day("2026-11-18", { planned: true, leave: "approved" }), day("2026-11-23", { planned: true })] }))).toBe(2));
  it("does not count today when you are on leave today", () =>
    expect(plannedCount(view({ days: [day("2026-11-16", { leave: "approved" }), day("2026-11-23", { planned: true })] }))).toBe(1));
});

describe("this week strip", () => {
  it("returns Monday to Friday of the current week with today flagged", () => {
    const strip = weekStrip(view());
    expect(strip.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
    expect(strip.map((d) => d.label)).toEqual(["Today", "Tue", "Wed", "Thu", "Fri"]);
    expect(strip.map((d) => d.day)).toEqual([16, 17, 18, 19, 20]);
    expect(strip.map((d) => d.state)).toEqual(["planned", "empty", "planned", "leave", "off"]);
    expect(strip.filter((d) => d.today).map((d) => d.date)).toEqual(["2026-11-16"]);
  });
  it("shows today as done once checked in at the office", () => {
    const v = view({ me: { mode: "office", source: "location", at: "2026-11-16T04:00:00Z" } });
    v.days[1] = { ...v.days[1], mode: "office" };
    expect(weekStrip(v)[0].state).toBe("done");
  });
});
