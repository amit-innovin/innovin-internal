import { describe, expect, it } from "vitest";
import { googleEventBody, googleEventId, guestList, mergeGuests } from "@/lib/calendar-rules";
import type { EmployeeRow } from "@/lib/types";

const person = (email: string, extra: Partial<EmployeeRow> = {}): EmployeeRow => ({ email, name: email, picture: "", role: "member", joinedOn: null, stepsOffset: 0, createdAt: "", lastSeenAt: "", ...extra });

describe("Google Calendar invite rules", () => {
  it("gives each event and generation one stable Google id in Google's alphabet", () => {
    const a = googleEventId("evt-1", 0);
    expect(a).toBe(googleEventId("evt-1", 0));
    expect(a).not.toBe(googleEventId("evt-1", 1));
    expect(a).not.toBe(googleEventId("evt-2", 0));
    expect(a).toMatch(/^[0-9a-v]{5,1024}$/);
  });

  it("invites each active person once, never the organizer, leavers or other domains", () => {
    const people = [person("A@innovinlabs.com"), person("a@innovinlabs.com"), person("org@innovinlabs.com"), person("gone@innovinlabs.com", { leftOn: "2026-11-01" }), person("x@gmail.com"), person("b@innovinlabs.com")];
    expect(guestList(people, "org@innovinlabs.com", ["innovinlabs.com"])).toEqual(["a@innovinlabs.com", "b@innovinlabs.com"]);
  });

  it("keeps existing guests' answers, adds newcomers, drops leavers", () => {
    const existing = [{ email: "a@innovinlabs.com", responseStatus: "accepted" }, { email: "gone@innovinlabs.com", responseStatus: "declined" }, { email: "org@innovinlabs.com", organizer: true, responseStatus: "accepted" }];
    expect(mergeGuests(existing, ["a@innovinlabs.com", "new@innovinlabs.com"])).toEqual([
      { email: "a@innovinlabs.com", responseStatus: "accepted" },
      { email: "new@innovinlabs.com", responseStatus: "needsAction" },
    ]);
  });

  it("builds a one-hour IST event with the guest list hidden", () => {
    const body = googleEventBody({ id: "e", title: "Diwali potluck", body: "Bring a dish", location: "Big room", category: "social", startsAt: "2026-11-20T07:30:00.000Z", createdBy: "", createdAt: "" }, "abc", [{ email: "a@innovinlabs.com", responseStatus: "needsAction" }]);
    expect(body).toMatchObject({
      id: "abc", summary: "Diwali potluck", description: "Bring a dish", location: "Big room",
      start: { dateTime: "2026-11-20T07:30:00.000Z", timeZone: "Asia/Kolkata" },
      end: { dateTime: "2026-11-20T08:30:00.000Z", timeZone: "Asia/Kolkata" },
      guestsCanSeeOtherGuests: false, guestsCanInviteOthers: false,
      attendees: [{ email: "a@innovinlabs.com", responseStatus: "needsAction" }],
    });
  });
});
