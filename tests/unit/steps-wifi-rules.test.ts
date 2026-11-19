import { describe, expect, it } from "vitest";
import { sevenDays } from "@/lib/steps-rules";
import { wifiVerdict } from "@/lib/wifi-rules";

describe("sevenDays", () => {
  it("is the last 7 days ending today, oldest first, with missing days at 0", () =>
    expect(sevenDays([{ date: "2026-11-18", steps: 4000 }, { date: "2026-11-14", steps: 12000 }, { date: "2026-11-01", steps: 9 }], "2026-11-18")).toEqual([
      { date: "2026-11-12", steps: 0 }, { date: "2026-11-13", steps: 0 }, { date: "2026-11-14", steps: 12000 }, { date: "2026-11-15", steps: 0 },
      { date: "2026-11-16", steps: 0 }, { date: "2026-11-17", steps: 0 }, { date: "2026-11-18", steps: 4000 },
    ]));
});

describe("wifiVerdict", () => {
  // Delay and upload are measured to our server (far from the office), so the verdict rests on
  // download and only an extreme delay; upload is shown but not judged.
  const ok = { down: 50, up: 1, delayMs: 250 };
  it("is good with a fair download even when the far server adds delay", () => expect(wifiVerdict(ok)).toBe("good"));
  it("is slow on a poor download or an extreme delay", () => {
    expect(wifiVerdict({ ...ok, down: 9.9 })).toBe("slow");
    expect(wifiVerdict({ ...ok, delayMs: 601 })).toBe("slow");
  });
});
