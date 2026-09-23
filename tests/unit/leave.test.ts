import { describe, expect, it } from "vitest";
import seed from "@/data/leave-2026.json";
import {
  canAvailEarned,
  completedMonths,
  earnedAccrued,
  flexibleEntitlement,
  holidaysFor,
  isWorkingDay,
  leaveCost,
  leaveLedger,
  leaveWorkingDays,
  nonWorkingReason,
  workingDaysInMonth,
} from "@/lib/leave";

describe("working days", () => {
  it("treats Sunday and the 2nd and 4th Saturday as non-working", () => {
    // Sep 2026: Saturdays fall on 5, 12, 19, 26 — the 2nd (12th) and 4th (26th) are off.
    expect(isWorkingDay("2026-09-05")).toBe(true); // 1st Saturday
    expect(isWorkingDay("2026-09-12")).toBe(false); // 2nd Saturday
    expect(isWorkingDay("2026-09-19")).toBe(true); // 3rd Saturday
    expect(isWorkingDay("2026-09-26")).toBe(false); // 4th Saturday
    expect(isWorkingDay("2026-09-06")).toBe(false); // Sunday
    expect(isWorkingDay("2026-09-07")).toBe(true); // Monday
  });

  it("treats declared holidays as non-working, even on a working weekday", () => {
    expect(isWorkingDay("2026-01-26")).toBe(false); // Republic Day, a Monday
    expect(isWorkingDay("2026-08-26")).toBe(false); // Onam, a Wednesday
    expect(nonWorkingReason("2026-01-26")).toBe("Republic Day");
    expect(nonWorkingReason("2026-09-06")).toBe("Sunday");
    expect(nonWorkingReason("2026-09-12")).toBe("2nd Saturday");
    expect(nonWorkingReason("2026-09-26")).toBe("4th Saturday");
    expect(nonWorkingReason("2026-09-07")).toBeNull();
  });

  it("lists the nine declared holidays for 2026 and nothing for unknown years", () => {
    expect(Object.keys(holidaysFor(2026))).toHaveLength(9);
    expect(holidaysFor(2030)).toEqual({});
  });

  // The 2026 tracker writes "Total working days- N" on each month sheet; these are those
  // figures, and they're what makes the Sunday + 2nd/4th Saturday + holiday rule trustworthy.
  it("reproduces the monthly working-day totals from the tracker", () => {
    expect(workingDaysInMonth(2026, 2)).toBe(22); // Feb
    expect(workingDaysInMonth(2026, 3)).toBe(23); // Mar (Ramzan)
    expect(workingDaysInMonth(2026, 4)).toBe(23); // Apr (Vishu)
    expect(workingDaysInMonth(2026, 5)).toBe(23); // May (May Day)
    expect(workingDaysInMonth(2026, 6)).toBe(24); // Jun
    expect(workingDaysInMonth(2026, 7)).toBe(25); // Jul
    expect(workingDaysInMonth(2026, 8)).toBe(22); // Aug (Independence Day + Onam)
    expect(workingDaysInMonth(2026, 9)).toBe(24); // Sep
  });
});

describe("leave cost", () => {
  it("counts only working days across a range", () => {
    // Mon 7 Sep → Mon 14 Sep: Sun 13 and 2nd Sat 12 are free, so 6 working days.
    expect(leaveWorkingDays("2026-09-07", "2026-09-14")).toBe(6);
    expect(leaveWorkingDays("2026-09-07", "2026-09-07")).toBe(1);
  });

  it("charges nothing for a range made entirely of non-working days", () => {
    expect(leaveWorkingDays("2026-09-12", "2026-09-13")).toBe(0); // 2nd Sat + Sunday
  });

  it("skips a holiday inside the range", () => {
    // Thu 19 Mar → Mon 23 Mar: Ramzan (20th) and Sunday (22nd) are free; 21st is a 3rd Saturday.
    expect(leaveWorkingDays("2026-03-19", "2026-03-23")).toBe(3);
  });

  it("returns 0 when the range is inverted", () => {
    expect(leaveWorkingDays("2026-09-10", "2026-09-07")).toBe(0);
  });

  it("charges a half day only for a single working day", () => {
    expect(leaveCost("2026-09-07", "2026-09-07", true)).toBe(0.5);
    expect(leaveCost("2026-09-07", "2026-09-08", true)).toBe(0); // not a single day
    expect(leaveCost("2026-09-06", "2026-09-06", true)).toBe(0); // Sunday
    expect(leaveCost("2026-09-07", "2026-09-08")).toBe(2);
  });
});

describe("earned leave", () => {
  it("counts only completed calendar months", () => {
    expect(completedMonths("2026-01-15", "2026-02-14")).toBe(0);
    expect(completedMonths("2026-01-15", "2026-02-15")).toBe(1);
    expect(completedMonths("2026-01-15", "2026-12-15")).toBe(11);
    expect(completedMonths("2025-01-15", "2026-01-15")).toBe(12);
    expect(completedMonths("2026-05-01", "2026-01-01")).toBe(0); // future joiner
  });

  it("accrues 1.25 days per completed month", () => {
    expect(earnedAccrued("2026-01-01", "2026-07-01")).toBe(7.5); // 6 months — matches "EL 26" in the tracker
    expect(earnedAccrued("2026-01-01", "2027-01-01")).toBe(15);
  });

  it("cannot be availed until a year of continuous service", () => {
    expect(canAvailEarned("2026-01-15", "2026-12-31")).toBe(false);
    expect(canAvailEarned("2026-01-15", "2027-01-15")).toBe(true);
  });
});

describe("flexible leave pro-rating", () => {
  it("gives the full entitlement to anyone who joined before the year", () => {
    expect(flexibleEntitlement("2024-06-01", 2026)).toBe(2);
    expect(flexibleEntitlement(null, 2026)).toBe(2);
  });

  it("pro-rates mid-year joiners and gives nothing before joining", () => {
    expect(flexibleEntitlement("2026-01-01", 2026)).toBe(2); // 12/12
    expect(flexibleEntitlement("2026-07-01", 2026)).toBe(1); // 6/12
    expect(flexibleEntitlement("2026-10-01", 2026)).toBe(0.5); // 3/12 → half-day steps
    expect(flexibleEntitlement("2027-02-01", 2026)).toBe(0);
  });
});

describe("ledger", () => {
  it("separates used, pending and remaining per type and ignores rejected rows", () => {
    const ledger = leaveLedger({
      entitlement: { cl: 8, sl: 6, fl: 2, el: 15 },
      requests: [
        { type: "cl", days: 2, status: "approved" },
        { type: "cl", days: 1, status: "pending" },
        { type: "cl", days: 3, status: "rejected" },
        { type: "sl", days: 1, status: "approved" },
      ],
    });
    const cl = ledger.find((l) => l.type === "cl")!;
    expect(cl).toMatchObject({ entitled: 8, used: 2, pending: 1, remaining: 6 });
    expect(ledger.find((l) => l.type === "sl")).toMatchObject({ used: 1, remaining: 5 });
    expect(ledger.find((l) => l.type === "fl")).toMatchObject({ used: 0, remaining: 2 });
    expect(ledger.map((l) => l.type)).not.toContain("ml"); // maternity isn't balance-counted
  });

  it("adds imported opening usage to what the app records", () => {
    const ledger = leaveLedger({
      entitlement: { cl: 8 },
      opening: { cl: 2.5 },
      requests: [{ type: "cl", days: 1, status: "approved" }],
    });
    expect(ledger.find((l) => l.type === "cl")).toMatchObject({ used: 3.5, remaining: 4.5 });
  });

  it("can go negative when someone is overdrawn rather than clamping at zero", () => {
    const ledger = leaveLedger({ entitlement: { cl: 4 }, opening: { cl: 6.5 }, requests: [] });
    expect(ledger.find((l) => l.type === "cl")?.remaining).toBe(-2.5);
  });

  it("keeps half days exact", () => {
    const ledger = leaveLedger({
      entitlement: { cl: 8 },
      requests: [
        { type: "cl", days: 0.5, status: "approved" },
        { type: "cl", days: 0.5, status: "approved" },
        { type: "cl", days: 1.5, status: "approved" },
      ],
    });
    expect(ledger.find((l) => l.type === "cl")).toMatchObject({ used: 2.5, remaining: 5.5 });
  });
});

describe("imported 2026 tracker data", () => {
  it("is a well-formed seed of 46 people", () => {
    expect(seed.year).toBe(2026);
    expect(seed.people).toHaveLength(46);
    for (const p of seed.people) expect(p.name.trim()).toBe(p.name);
  });

  // entitlement = availed + balance held for every row in the sheet, which is why the
  // import stores per-person entitlements instead of assuming one company-wide figure.
  it("reproduces the balances shown in the spreadsheet", () => {
    const amit = seed.people.find((p) => p.name === "Amit Jaison")!;
    expect(amit.entitlement).toMatchObject({ cl: 8, fl: 2, sl: 6 });
    const ledger = leaveLedger({ entitlement: amit.entitlement, opening: amit.used, requests: [] });
    expect(ledger.find((l) => l.type === "cl")).toMatchObject({ used: 2.5, remaining: 5.5 });
    expect(ledger.find((l) => l.type === "fl")).toMatchObject({ used: 1, remaining: 1 });
    expect(ledger.find((l) => l.type === "sl")).toMatchObject({ used: 0, remaining: 6 });

    // Sreeprabha is the overdrawn case under the new policy: 6.5 CL taken against 8.
    const sree = seed.people.find((p) => p.name === "Sreeprabha")!;
    const sreeLedger = leaveLedger({ entitlement: sree.entitlement, opening: sree.used, requests: [] });
    expect(sreeLedger.find((l) => l.type === "cl")).toMatchObject({ used: 6.5, remaining: 1.5 });
  });

  it("carries the two entitlement cohorts: full-time staff and trainees", () => {
    const cohorts = new Map<string, number>();
    for (const p of seed.people) {
      const key = JSON.stringify(p.entitlement);
      cohorts.set(key, (cohorts.get(key) ?? 0) + 1);
    }
    expect(cohorts.get(JSON.stringify({ cl: 8, fl: 2, sl: 6 }))).toBe(24);
    expect(cohorts.get(JSON.stringify({ cl: 2, fl: 1, sl: 3 }))).toBe(21);
  });
});
