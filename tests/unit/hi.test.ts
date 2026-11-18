import { describe, expect, it } from "vitest";
import { hiReplyTitle, hiTitle, sentLabel, validHiTime } from "@/lib/hi";

describe("Say hi wording", () => {
  it("reads like the prototype", () => {
    expect(hiTitle({ kind: "wave", atTime: null }, "Arjun")).toBe("Arjun waved");
    expect(hiTitle({ kind: "chai", atTime: "30" }, "Arjun")).toBe("Arjun: chai break in 30 min?");
    expect(hiTitle({ kind: "lunch", atTime: "13:00" }, "Arjun")).toBe("Arjun: lunch together at 1:00 pm?");
    expect(hiReplyTitle({ kind: "walk", reply: "yes" }, "Meera")).toBe("Meera is in for a walk");
    expect(hiReplyTitle({ kind: "chai", reply: "no" }, "Meera")).toBe("Meera can't make chai today");
    expect(sentLabel({ kind: "chai", atTime: "now" })).toBe("Chai now");
  });
  it("takes invite times of now, in 30 min, or quarter hours from 9:00 to 19:00", () => {
    for (const ok of ["now", "30", "09:00", "13:45", "19:00"]) expect(validHiTime(ok)).toBe(true);
    for (const bad of ["08:45", "19:15", "13:10", "later", 30, null]) expect(validHiTime(bad)).toBe(false);
  });
});
