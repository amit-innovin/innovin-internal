import { describe, expect, it } from "vitest";
import { stepBoard, stepStreak, STEP_GOAL } from "@/lib/steps";
import type { EmployeeRow, StepsRow } from "@/lib/types";

const emp = (email: string, name = email, stepsOffset = 0): EmployeeRow => ({
  email,
  name,
  picture: "",
  role: "member",
  joinedOn: null,
  stepsOffset,
  createdAt: "2026-01-01T00:00:00Z",
  lastSeenAt: "2026-01-01T00:00:00Z",
});

const row = (email: string, date: string, hit = true, steps: number | null = null): StepsRow => ({
  id: `${email}-${date}`,
  email,
  date,
  hit,
  steps,
  createdAt: `${date}T10:00:00Z`,
});

const TODAY = "2026-10-05";

describe("stepStreak", () => {
  it("counts back from today, and survives until tonight if yesterday was a hit", () => {
    expect(stepStreak(["2026-10-05", "2026-10-04", "2026-10-03", "2026-10-01"], TODAY)).toBe(3);
    expect(stepStreak(["2026-10-04", "2026-10-03"], TODAY)).toBe(2);
    expect(stepStreak(["2026-10-02"], TODAY)).toBe(0);
    expect(stepStreak([], TODAY)).toBe(0);
  });
});

describe("stepBoard", () => {
  it("adds the sheet offset to logged hits and sorts by days", () => {
    const board = stepBoard(
      [emp("a@x", "Asha", 40), emp("b@x", "Binu", 0), emp("c@x", "Nobody")],
      [row("b@x", "2026-10-05"), row("b@x", "2026-10-04"), row("a@x", "2026-10-03", false)],
      TODAY,
    );
    expect(board.map((b) => b.name)).toEqual(["Asha", "Binu"]);
    expect(board[0].days).toBe(40); // offset only — the missed day doesn't count
    expect(board[1].days).toBe(2);
    expect(board[1].todayHit).toBe(true);
    expect(board[1].streak).toBe(2);
  });

  it("drops people with nothing logged and no offset", () => {
    expect(stepBoard([emp("a@x")], [], TODAY)).toEqual([]);
    expect(stepBoard([emp("a@x", "A", 3)], [], TODAY)[0].days).toBe(3);
  });
});
