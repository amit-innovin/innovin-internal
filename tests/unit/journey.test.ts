import { expect, it } from "vitest";
import { boardHref, eventHref, leaveHref } from "@/lib/journey";
it("sends leave updates to Days, where leave and balances live", () => {
  expect(leaveHref()).toBe("/days");
});
it("gives board announcements and events shareable item destinations",()=>{
  expect(boardHref("ann-1")).toBe("/feed#announcement-ann-1");
  expect(boardHref()).toBe("/feed");
  expect(eventHref("evt-1")).toBe("/feed/events/evt-1");
});
