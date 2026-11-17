import { describe, expect, it } from "vitest";
import { isPlanned } from "@/lib/plan";

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
