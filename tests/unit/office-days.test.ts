import { describe, expect, it } from "vitest";
import { countOfficeDays, expectedOn, fixableFrom, monthBounds, officeDayTarget, officeDaysSummary, scheduleLabel, weekdayIndex } from "@/lib/office-days";
import type { AttendanceRow } from "@/lib/types";

const row = (date: string, declaredMode: "office" | "remote" | null): AttendanceRow => ({ id: date, email: "a@innovinlabs.com", date, checkInAt: `${date}T04:00:00.000Z`, checkOutAt: null, lat: null, lng: null, accuracyM: null, declaredMode });

describe("office days", () => {
  it("counts each office day once and ignores remote days", () => {
    expect(countOfficeDays([row("2026-11-02", "office"), row("2026-11-04", "office"), row("2026-11-05", "remote"), row("2026-11-04", "office")])).toBe(2);
    // A day that was checked out under the old flow still counts: there is no check-out any more.
    const checkedOut: AttendanceRow = { ...row("2026-11-03", "office"), checkOutAt: "2026-11-03T12:00:00.000Z" };
    expect(countOfficeDays([checkedOut])).toBe(1);
  });

  it("target is 8, nothing for exempt people, and pro-rated for someone who joined mid-month", () => {
    expect(officeDayTarget({ joinedOn: null, officeExempt: false }, "2026-11")).toBe(8);
    expect(officeDayTarget({ joinedOn: "2024-03-01", officeExempt: false }, "2026-11")).toBe(8);
    expect(officeDayTarget({ joinedOn: null, officeExempt: true }, "2026-11")).toBeNull();
    // Joined on Mon 16 Nov: 12 of November's 23 working days remain → 8 × 12/23 = 4.17 → 4.
    expect(officeDayTarget({ joinedOn: "2026-11-16", officeExempt: false }, "2026-11")).toBe(4);
    // Joined on the last working day: still asked for one day, never zero.
    expect(officeDayTarget({ joinedOn: "2026-11-30", officeExempt: false }, "2026-11")).toBe(1);
    // Not joined yet in that month.
    expect(officeDayTarget({ joinedOn: "2026-12-01", officeExempt: false }, "2026-11")).toBe(0);
  });

  it("summarises progress the way the canvas words it", () => {
    const s = officeDaysSummary({ done: 3, target: 8, month: "2026-11", today: "2026-11-09" });
    expect(s).toMatchObject({ done: 3, target: 8, toGo: 5, status: "on-track", lastDay: "2026-11-30" });
    // Six of November's 23 working days are over by the 9th, so the pace is 8 × 6/23 = 2.09 → 2 days.
    expect(officeDaysSummary({ done: 1, target: 8, month: "2026-11", today: "2026-11-09" }).status).toBe("behind");
    expect(officeDaysSummary({ done: 2, target: 8, month: "2026-11", today: "2026-11-09" }).status).toBe("on-track");
    // A past month is judged on the whole month.
    expect(officeDaysSummary({ done: 7, target: 8, month: "2026-10", today: "2026-11-09" }).status).toBe("behind");
    expect(officeDaysSummary({ done: 8, target: 8, month: "2026-11", today: "2026-11-09" })).toMatchObject({ toGo: 0, status: "done" });
    expect(officeDaysSummary({ done: 9, target: 8, month: "2026-11", today: "2026-11-09" })).toMatchObject({ toGo: 0, status: "done" });
    expect(officeDaysSummary({ done: 0, target: null, month: "2026-11", today: "2026-11-09" })).toMatchObject({ toGo: 0, status: "exempt" });
    // On the first working day nobody is behind yet.
    expect(officeDaysSummary({ done: 0, target: 8, month: "2026-11", today: "2026-11-02" }).status).toBe("on-track");
  });

  it("knows who is expected on a date from their regular days", () => {
    expect(weekdayIndex("2026-11-09")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-15")).toBe(6); // Sunday
    expect(expectedOn([0, 2], "2026-11-09")).toBe(true);
    expect(expectedOn([0, 2], "2026-11-10")).toBe(false);
    expect(expectedOn([], "2026-11-09")).toBe(false);
    // Nobody is expected on a weekend or a company holiday, whatever their schedule says.
    expect(expectedOn([0, 1, 2, 3, 4, 5, 6], "2026-11-14")).toBe(false);
    expect(scheduleLabel([0, 2])).toBe("Mon + Wed");
    expect(scheduleLabel([4, 1])).toBe("Tue + Fri");
    expect(scheduleLabel([])).toBe("Not set");
  });

  it("members can fix their own last 7 days, never today's future or anything older", () => {
    expect(fixableFrom("2026-11-09")).toBe("2026-11-02");
    expect(monthBounds("2026-11")).toEqual({ first: "2026-11-01", last: "2026-11-30" });
    expect(monthBounds("2026-02")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
  });
});
