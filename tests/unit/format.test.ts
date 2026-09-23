import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstName, fmtDay, fmtHour, fmtShortDate, fmtTime, greeting, initials, leaveDays, relativeDay, relativeTime } from "@/lib/format";

// 2026-09-23 09:12 IST == 03:42 UTC
const NOW = new Date("2026-09-23T03:42:00.000Z");

describe("format", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("formats times and dates in IST", () => {
    expect(fmtTime(NOW.toISOString())).toBe("9:12 AM");
    expect(fmtShortDate(NOW.toISOString())).toBe("23 Sep");
    expect(fmtDay(NOW)).toBe("Wed, 23 Sep");
  });

  it("uses the IST calendar day, not UTC, for relative days", () => {
    // 20:00 UTC on the 22nd is 01:30 IST on the 23rd → "Today" in the office.
    expect(relativeDay("2026-09-22T20:00:00.000Z")).toBe("Today");
    expect(relativeDay("2026-09-22T10:00:00.000Z")).toBe("Yesterday");
    expect(relativeDay("2026-09-20T10:00:00.000Z")).toBe("3 days ago");
  });

  it("describes elapsed time", () => {
    expect(relativeTime(new Date(NOW.getTime() - 20_000).toISOString())).toBe("Just now");
    expect(relativeTime(new Date(NOW.getTime() - 5 * 60_000).toISOString())).toBe("5 min ago");
    expect(relativeTime(new Date(NOW.getTime() - 60 * 60_000).toISOString())).toBe("1 hour ago");
    expect(relativeTime(new Date(NOW.getTime() - 3 * 3600_000).toISOString())).toBe("3 hours ago");
    expect(relativeTime(new Date(NOW.getTime() - 30 * 3600_000).toISOString())).toBe("Yesterday");
  });

  it("greets by IST hour", () => {
    expect(greeting(new Date("2026-09-23T03:42:00.000Z"))).toBe("Good morning"); // 09:12
    expect(greeting(new Date("2026-09-23T08:30:00.000Z"))).toBe("Good afternoon"); // 14:00
    expect(greeting(new Date("2026-09-23T13:30:00.000Z"))).toBe("Good evening"); // 19:00
  });

  it("formats cutoff hours", () => {
    expect(fmtHour(11)).toBe("11:00 AM");
    expect(fmtHour(12)).toBe("12:00 PM");
    expect(fmtHour(15)).toBe("3:00 PM");
    expect(fmtHour(0)).toBe("12:00 AM");
    expect(fmtHour(24)).toBe("midnight");
  });

  it("counts leave days inclusively", () => {
    expect(leaveDays("2026-10-07", "2026-10-07")).toBe(1);
    expect(leaveDays("2026-10-01", "2026-10-05")).toBe(5);
    expect(leaveDays("2026-10-05", "2026-10-01")).toBe(0); // bad range clamps, never negative
  });

  it("derives names and initials from emails", () => {
    expect(firstName("amit.jaison@innovinlabs.com")).toBe("Amit");
    expect(firstName("priya_k@innovinlabs.com")).toBe("Priya");
    expect(firstName(null)).toBeNull();
    expect(initials("amit.jaison@innovinlabs.com")).toBe("AJ");
    expect(initials("solo@innovinlabs.com")).toBe("S");
  });
});
