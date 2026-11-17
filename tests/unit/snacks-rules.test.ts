import { describe, expect, it } from "vitest";
import { currentRound, DEFAULT_SNACK_TIMES as T, istClock, pickCounts, pickOpen, validTimes } from "@/lib/snacks-rules";

// IST is UTC+5:30, so 10:44 IST is 05:14 UTC.
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 10, 18, h, m) - 5.5 * 3600_000);
};

describe("tea rounds", () => {
  it("reads the clock in office time", () => expect(istClock(at("10:44"))).toBe("10:44"));
  it("is the morning round until 11:00, open until 10:45", () => {
    expect(currentRound(at("10:44"), T)).toEqual({ id: "am", at: "11:00", closesAt: "10:45", open: true, next: "pm" });
    expect(currentRound(at("10:46"), T)).toMatchObject({ id: "am", open: false, next: "pm" });
  });
  it("is the afternoon round until 4 PM, open until 3:30", () => {
    expect(currentRound(at("11:30"), T)).toEqual({ id: "pm", at: "16:00", closesAt: "15:30", open: true, next: null });
    expect(currentRound(at("15:31"), T)).toMatchObject({ id: "pm", open: false });
  });
  it("has no more tea after the afternoon round", () => expect(currentRound(at("16:30"), T)).toBeNull());
});

describe("snack picks", () => {
  it("are open until the order time, and not once today's order is placed", () => {
    expect(pickOpen(at("11:59"), T, false)).toBe(true);
    expect(pickOpen(at("12:00"), T, false)).toBe(false);
    expect(pickOpen(at("09:00"), T, true)).toBe(false);
  });
  it("count one pick per person", () =>
    expect(pickCounts([{ itemId: "a", voterRef: "1" }, { itemId: "a", voterRef: "2" }, { itemId: "b", voterRef: "3" }], ["a", "b", "c"])).toEqual({ a: 2, b: 1, c: 0 }));
});

describe("validTimes", () => {
  it("needs HH:MM times with each round's answers closing before it", () => {
    expect(validTimes(T)).toBe(true);
    expect(validTimes({ ...T, amClose: "11:00" })).toBe(false);
    expect(validTimes({ ...T, orderAt: "9am" })).toBe(false);
  });
});
