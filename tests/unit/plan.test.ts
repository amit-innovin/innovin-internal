import { describe, expect, it } from "vitest";
import { isPlanned, plannedOn } from "@/lib/plan";

// Today is Mon 16 Nov 2026; the person's usual days are Monday and Wednesday (0 and 2).
const base = { today: "2026-11-16", officeDays: [0, 2], override: undefined, working: true, leave: false };

describe("isPlanned", () => {
  it("plans a usual day", () => expect(isPlanned({ ...base, date: "2026-11-18" })).toBe(true));
  it("lets an override remove a usual day", () => expect(isPlanned({ ...base, date: "2026-11-18", override: false })).toBe(false));
  it("lets an override add any other day", () => {
    expect(isPlanned({ ...base, date: "2026-11-19" })).toBe(false);
    expect(isPlanned({ ...base, date: "2026-11-19", override: true })).toBe(true);
  });
  it("never plans today or the past", () => {
    expect(isPlanned({ ...base, date: "2026-11-16", override: true })).toBe(false);
    expect(isPlanned({ ...base, date: "2026-11-11", override: true })).toBe(false);
  });
  it("never plans a closed or non-working day", () => expect(isPlanned({ ...base, date: "2026-11-25", working: false, override: true })).toBe(false));
  it("never plans a leave day", () => expect(isPlanned({ ...base, date: "2026-11-18", leave: true, override: true })).toBe(false));
});

describe("plannedOn (today, for Home)", () => {
  const day = { officeDays: [0, 2], override: undefined, working: true, leave: false };
  it("counts a single date planned the day before", () => expect(plannedOn({ ...day, date: "2026-11-17", override: true })).toBe(true));
  it("drops a usual day taken out of the plan", () => expect(plannedOn({ ...day, date: "2026-11-16", override: false })).toBe(false));
  it("is the usual day otherwise, and never a closed or leave day", () => {
    expect(plannedOn({ ...day, date: "2026-11-16" })).toBe(true);
    expect(plannedOn({ ...day, date: "2026-11-16", working: false })).toBe(false);
    expect(plannedOn({ ...day, date: "2026-11-16", leave: true })).toBe(false);
  });
});
