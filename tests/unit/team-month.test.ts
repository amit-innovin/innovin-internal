import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The admin People grid (canvas: M3AdminApp › People): who was in the office on which day, for
// everyone, with no counts. Leave and closed days show; days after today are blank.
const dir = path.join(os.tmpdir(), `innovin-team-month-${process.pid}`);
Object.assign(process.env, { DATA_FILE: path.join(dir, "store.json"), DATABASE_URL: "" });

let store: typeof import("@/lib/store").store;
let teamMonth: typeof import("@/lib/admin-view").teamMonth;
const person = (email: string, name: string, extra: { exempt?: boolean } = {}) =>
  store.upsertEmployee({ email, name, picture: "", role: "member", joinedOn: null, stepsOffset: 0, createdAt: "", lastSeenAt: "" }).then(async () => { if (extra.exempt) await store.setOfficeExempt(email, true); });
const inOffice = (email: string, date: string) =>
  store.markDay({ id: `${email}-${date}`, email, date, checkInAt: `${date}T04:00:00.000Z`, checkOutAt: null, lat: null, lng: null, accuracyM: null, declaredMode: "office", source: "admin" });

beforeAll(async () => {
  store = (await import("@/lib/store")).store;
  teamMonth = (await import("@/lib/admin-view")).teamMonth;
});
beforeEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("teamMonth", () => {
  it("lists working days as columns, closed days included and marked", async () => {
    await store.addClosedDay({ date: "2026-11-27", reason: "Maintenance", createdBy: "a@innovinlabs.com", createdAt: "" });
    const t = await teamMonth("2026-11", "2026-11-19");
    const dates = t.days.map((d) => d.date);
    expect(dates).toContain("2026-11-02"); // Monday
    expect(dates).not.toContain("2026-11-01"); // Sunday
    expect(dates).not.toContain("2026-11-14"); // 2nd Saturday: never a working day
    expect(t.days.find((d) => d.date === "2026-11-27")).toEqual({ date: "2026-11-27", closed: true, future: true });
    expect(t.days.find((d) => d.date === "2026-11-19")).toMatchObject({ future: false });
  });

  it("marks each person's office and leave days, and nothing after today", async () => {
    await person("a@innovinlabs.com", "Anita Rao");
    await person("b@innovinlabs.com", "Arjun Kumar", { exempt: true });
    await inOffice("a@innovinlabs.com", "2026-11-02");
    await inOffice("a@innovinlabs.com", "2026-11-19");
    await inOffice("a@innovinlabs.com", "2026-11-20"); // after "today": not shown
    await store.addAway({ id: "l1", email: "b@innovinlabs.com", type: "leave", leaveType: "cl", halfDay: false, days: 2, startDate: "2026-11-09", endDate: "2026-11-10", reason: "", status: "approved", submitterRef: "x", decidedBy: null, decidedAt: null, createdAt: "" });
    await store.addAway({ id: "l2", email: "b@innovinlabs.com", type: "leave", leaveType: "cl", halfDay: false, days: 1, startDate: "2026-11-24", endDate: "2026-11-24", reason: "", status: "approved", submitterRef: "x", decidedBy: null, decidedAt: null, createdAt: "" }); // upcoming: blank, as drawn
    const t = await teamMonth("2026-11", "2026-11-19");
    const anita = t.people.find((p) => p.email === "a@innovinlabs.com")!;
    expect(anita.marks).toEqual({ "2026-11-02": "office", "2026-11-19": "office" });
    const arjun = t.people.find((p) => p.email === "b@innovinlabs.com")!;
    expect(arjun).toMatchObject({ name: "Arjun Kumar", exempt: true, left: false });
    expect(arjun.marks).toEqual({ "2026-11-09": "leave", "2026-11-10": "leave" });
    // No counts or verdicts anywhere in what the grid gets.
    expect(JSON.stringify(t)).not.toMatch(/"(done|target|status|behind|count)"/);
  });

  it("keeps people marked as left, flagged, for the Left filter", async () => {
    await person("gone@innovinlabs.com", "Gone Person");
    await store.setLeftOn("gone@innovinlabs.com", "2026-11-10");
    const t = await teamMonth("2026-11", "2026-11-19");
    expect(t.people.find((p) => p.email === "gone@innovinlabs.com")?.left).toBe(true);
  });
});

it("shows Zoho approvals for the mapped employee in both Days and the admin grid", async () => {
  const email = "mapped@innovinlabs.com";
  const date = "2026-11-02";
  await person(email, "Mapped Employee");
  await person("unmapped@innovinlabs.com", "Other Employee");
  vi.stubEnv("ZOHO_CLIENT_ID", "test-id");
  vi.stubEnv("ZOHO_CLIENT_SECRET", "test-secret");
  vi.stubEnv("ZOHO_REFRESH_TOKEN", "test-refresh");
  vi.stubEnv("ZOHO_DATE_FORMAT", "yyyy-MM-dd");
  vi.stubEnv("ZOHO_EMPLOYEE_IDS", JSON.stringify({ [email]: "42" }));
  vi.stubEnv("ZOHO_LEAVE_TYPE_IDS", JSON.stringify({ cl: "1", sl: "2", el: "3", fl: "4" }));
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = new URL(input.toString());
    if (url.hostname.startsWith("accounts.")) return Response.json({ access_token: "mock-token", expires_in: 3600 });
    if (url.pathname.endsWith("bookedAndBalance")) return Response.json({ report: { "42": { "1": { balance: 2 } } } });
    return Response.json({ records: { r1: {
      "Employee.ID": "42", From: date, To: date, ApprovalStatus: "Approved",
      Leavetype: "Casual leave", Unit: "Day", Days: { [date]: { LeaveCount: 1 } }, Reason: "Private",
    } } });
  });
  try {
    const { daysView } = await import("@/lib/days");
    const [member, team] = await Promise.all([daysView(email, "2026-11"), teamMonth("2026-11", "2026-11-19")]);
    expect(member.days.find((day) => day.date === date)).toMatchObject({ leave: "approved", planned: false });
    expect(team.people.find((employee) => employee.email === email)?.marks[date]).toBe("leave");
    expect(team.people.find((employee) => employee.email !== email)?.marks[date]).toBeUndefined();
    expect(JSON.stringify([member, team])).not.toContain("Private");
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
