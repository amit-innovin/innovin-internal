import { expect, it } from "vitest";
import { attendanceHref, attendanceView, boardHref, eventHref } from "@/lib/journey";
it("returns an exact recorded day or request rather than an unrelated default tab", () => {
  expect(attendanceHref("calendar", "2026-11-05")).toBe("/attendance?tab=calendar&date=2026-11-05");
  expect(attendanceHref("leave", undefined, "request/1")).toBe("/attendance?tab=leave&request=request%2F1");
  expect(attendanceView(new URLSearchParams("tab=calendar&date=2026-11-05"), "2026-10-27")).toEqual({ tab:"calendar", date:"2026-11-05", month:"2026-11", request:null });
  expect(attendanceView(new URLSearchParams("tab=bad&date=2026-02-30"), "2026-10-27")).toEqual({ tab:"today",date:null,month:"2026-10",request:null });
});
it("gives board announcements and events shareable item destinations",()=>{
  expect(boardHref("ann-1")).toBe("/?view=board&announcement=ann-1#announcement-ann-1");
  expect(eventHref("evt-1")).toBe("/events?event=evt-1#event-evt-1");
});
