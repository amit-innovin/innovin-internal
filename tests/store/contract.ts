import { beforeEach, describe, expect, it } from "vitest";
import type { AttendanceRow, AwayRow, EmployeeRow, EventRow, GrievanceRow, OrderRow, Store, WifiRow } from "@/lib/types";

// Behavioural contract every Store adapter must satisfy (JSON file + Postgres).
export function storeContract(name: string, getStore: () => Promise<Store>, resetData: () => Promise<void>) {
  describe(`${name} store contract`, () => {
    let store: Store;
    let seq = 0;
    const iso = (offsetMs = 0) => new Date(Date.UTC(2026, 8, 23, 4, 0, 0) + offsetMs).toISOString();
    const uid = () => `id-${Date.now()}-${++seq}`;

    beforeEach(async () => {
      store = await getStore();
      await resetData();
    });

    const attendance = (p: Partial<AttendanceRow> = {}): AttendanceRow => ({
      id: uid(),
      email: "a@innovinlabs.com",
      date: "2026-09-23",
      checkInAt: iso(),
      checkOutAt: null,
      lat: null,
      lng: null,
      accuracyM: null,
      ...p,
    });
    const order = (p: Partial<OrderRow> = {}): OrderRow => ({
      id: uid(),
      date: "2026-09-23",
      itemId: "tea",
      preference: "anything",
      instructions: "",
      submitterRef: "ref-1",
      createdAt: iso(),
      ...p,
    });
    const grievance = (p: Partial<GrievanceRow> = {}): GrievanceRow => ({
      id: uid(),
      body: "Issue",
      displayName: null,
      image: null,
      submitterRef: "ref-1",
      status: "open",
      createdAt: iso(),
      ...p,
    });
    const wifi = (p: Partial<WifiRow> = {}): WifiRow => ({
      id: uid(),
      quality: "good",
      note: "",
      downMbps: null,
      upMbps: null,
      createdAt: iso(),
      ...p,
    });
    const away = (p: Partial<AwayRow> = {}): AwayRow => ({
      id: uid(),
      email: "a@innovinlabs.com",
      type: "leave",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      reason: "",
      leaveType: "cl",
      halfDay: false,
      days: 2,
      status: "pending",
      submitterRef: "ref-1",
      decidedBy: null,
      decidedAt: null,
      createdAt: iso(),
      ...p,
    });
    const employee = (p: Partial<EmployeeRow> = {}): EmployeeRow => ({
      email: "a@innovinlabs.com",
      name: "Asha",
      picture: "",
      role: "member",
      joinedOn: null,
      createdAt: iso(),
      lastSeenAt: iso(),
      ...p,
    });
    const event = (p: Partial<EventRow> = {}): EventRow => ({
      id: uid(),
      title: "Match screening",
      body: "",
      category: "sports",
      startsAt: iso(86_400_000),
      location: "",
      createdBy: "admin",
      createdAt: iso(),
      ...p,
    });

    describe("attendance", () => {
      it("returns the open session on repeat check-in, then starts a new session after checkout", async () => {
        const first = await store.checkIn(attendance());
        const again = await store.checkIn(attendance({ checkInAt: iso(60_000) }));
        expect(again.id).toBe(first.id);
        expect(again.checkInAt).toBe(first.checkInAt);
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);

        await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(3_600_000));
        const second = await store.checkIn(attendance({ checkInAt: iso(4_000_000) }));
        expect(second.id).not.toBe(first.id);
        const sessions = await store.listAttendanceByEmail("a@innovinlabs.com", "2026-09-23");
        expect(sessions).toHaveLength(2);
        expect(sessions[1].checkInAt).toBe(iso(4_000_000));
      });

      it("getAttendance returns only the open session; checkOut closes it once", async () => {
        const row = await store.checkIn(attendance());
        expect((await store.getAttendance("a@innovinlabs.com", "2026-09-23"))?.id).toBe(row.id);
        expect(await store.getAttendance("b@innovinlabs.com", "2026-09-23")).toBeNull();
        const out = await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(3_600_000));
        expect(out?.checkOutAt).toBe(iso(3_600_000));
        expect(await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(4_000_000))).toBeNull();
        expect(await store.checkOut("nobody@innovinlabs.com", "2026-09-23", iso())).toBeNull();
        expect(await store.getAttendance("a@innovinlabs.com", "2026-09-23")).toBeNull();
      });

      it("round-trips the check-in location, defaulting to null", async () => {
        await store.checkIn(attendance({ email: "loc@innovinlabs.com", lat: 12.935, lng: 77.624, accuracyM: 18 }));
        await store.checkIn(attendance({ email: "noloc@innovinlabs.com" }));
        const rows = await store.listAttendance("2026-09-23");
        expect(rows.find((r) => r.email === "loc@innovinlabs.com")).toMatchObject({ lat: 12.935, lng: 77.624, accuracyM: 18 });
        expect(rows.find((r) => r.email === "noloc@innovinlabs.com")).toMatchObject({ lat: null, lng: null, accuracyM: null });
      });

      it("lists one day ordered by check-in time, with separate sessions per person", async () => {
        await store.checkIn(attendance({ email: "late@innovinlabs.com", checkInAt: iso(120_000) }));
        await store.checkIn(attendance({ email: "early@innovinlabs.com", checkInAt: iso(0) }));
        await store.checkIn(attendance({ email: "other-day@innovinlabs.com", date: "2026-09-22" }));
        const rows = await store.listAttendance("2026-09-23");
        expect(rows.map((r) => r.email)).toEqual(["early@innovinlabs.com", "late@innovinlabs.com"]);
        expect(await store.listAttendanceByEmail("early@innovinlabs.com", "2026-09-22")).toHaveLength(0);
      });
    });

    describe("orders", () => {
      it("replaces the day's selection atomically — several items, then fewer", async () => {
        await store.setDayOrders("2026-09-23", "ref-1", [order()]);
        const replaced = await store.setDayOrders("2026-09-23", "ref-1", [
          order({ itemId: "healthy", preference: "healthy", instructions: "no sugar" }),
          order({ itemId: "lunch" }),
        ]);
        expect(replaced).toHaveLength(2);
        const listed = await store.listOrders("2026-09-23");
        expect(listed.map((o) => o.itemId).sort()).toEqual(["healthy", "lunch"]);
        expect(listed.find((o) => o.itemId === "healthy")?.instructions).toBe("no sugar");
        // Replacing again shrinks the selection, not just adds.
        await store.setDayOrders("2026-09-23", "ref-1", [order({ itemId: "tea" })]);
        expect((await store.listOrders("2026-09-23")).map((o) => o.itemId)).toEqual(["tea"]);
      });

      it("keeps different devices and days separate", async () => {
        await store.setDayOrders("2026-09-23", "ref-1", [order({ submitterRef: "ref-1" })]);
        await store.setDayOrders("2026-09-23", "ref-2", [order({ submitterRef: "ref-2", createdAt: iso(1000) })]);
        await store.setDayOrders("2026-09-22", "ref-1", [order({ submitterRef: "ref-1", date: "2026-09-22" })]);
        expect((await store.listOrders("2026-09-23")).map((o) => o.submitterRef).sort()).toEqual(["ref-1", "ref-2"]);
      });

      it("lists a device's history newest day first with a limit", async () => {
        for (const date of ["2026-09-20", "2026-09-22", "2026-09-21"]) await store.setDayOrders(date, "ref-1", [order({ date })]);
        await store.setDayOrders("2026-09-23", "someone-else", [order({ submitterRef: "someone-else" })]);
        const history = await store.listOrdersByRef("ref-1", 2);
        expect(history.map((o) => o.date)).toEqual(["2026-09-22", "2026-09-21"]);
      });

      it("deletes all of that device's rows for that day", async () => {
        await store.setDayOrders("2026-09-23", "ref-1", [order(), order({ itemId: "lunch" })]);
        await store.setDayOrders("2026-09-22", "ref-1", [order({ date: "2026-09-22" })]);
        await store.setDayOrders("2026-09-23", "ref-2", [order({ submitterRef: "ref-2" })]);
        expect(await store.deleteOrder("ref-1", "2026-09-23")).toBe(true);
        expect(await store.deleteOrder("ref-1", "2026-09-23")).toBe(false);
        expect((await store.listOrders("2026-09-23")).map((o) => o.submitterRef)).toEqual(["ref-2"]);
        expect(await store.listOrdersByRef("ref-1", 10)).toHaveLength(1);
      });
    });

    describe("grievances", () => {
      it("adds and lists newest first, preserving anonymity fields", async () => {
        await store.addGrievance(grievance({ body: "older", createdAt: iso(0) }));
        await store.addGrievance(grievance({ body: "newer", displayName: "Amit", createdAt: iso(5000) }));
        const rows = await store.listGrievances();
        expect(rows.map((g) => g.body)).toEqual(["newer", "older"]);
        expect(rows[1].displayName).toBeNull();
        expect(rows[0].displayName).toBe("Amit");
      });

      it("never stores a device-linked submitter ref — rows are always 'anon'", async () => {
        await store.addGrievance(grievance({ submitterRef: "ref-1" }));
        await store.addGrievance(grievance({ submitterRef: "sha256-of-device", displayName: "Amit" }));
        const rows = await store.listGrievances();
        expect(rows.every((g) => g.submitterRef === "anon")).toBe(true);
      });

      it("round-trips an attached image, defaulting to null", async () => {
        await store.addGrievance(grievance({ body: "with photo", image: "data:image/jpeg;base64,abc" }));
        await store.addGrievance(grievance({ body: "no photo", createdAt: iso(1000) }));
        const rows = await store.listGrievances();
        expect(rows.find((g) => g.body === "with photo")?.image).toBe("data:image/jpeg;base64,abc");
        expect(rows.find((g) => g.body === "no photo")?.image).toBeNull();
        const mine = await store.listGrievancesByIds(rows.map((g) => g.id), 10);
        expect(mine.find((g) => g.body === "with photo")?.image).toBe("data:image/jpeg;base64,abc");
      });

      it("updates status and reports unknown ids", async () => {
        const g = await store.addGrievance(grievance());
        expect(await store.setGrievanceStatus(g.id, "resolved")).toBe(true);
        expect((await store.listGrievances())[0].status).toBe("resolved");
        expect(await store.setGrievanceStatus("missing", "resolved")).toBe(false);
      });

      it("looks grievances up by id list, newest first, with a limit", async () => {
        const g1 = await store.addGrievance(grievance({ body: "one", createdAt: iso(0) }));
        await store.addGrievance(grievance({ body: "not asked for", createdAt: iso(1000) }));
        const g2 = await store.addGrievance(grievance({ body: "two", createdAt: iso(2000) }));
        const g3 = await store.addGrievance(grievance({ body: "three", createdAt: iso(3000) }));
        expect((await store.listGrievancesByIds([g1.id, g2.id, g3.id], 2)).map((g) => g.body)).toEqual(["three", "two"]);
        expect(await store.listGrievancesByIds(["missing"], 10)).toEqual([]);
        expect(await store.listGrievancesByIds([], 10)).toEqual([]);
      });
    });

    describe("wifi & announcements", () => {
      it("stores reports with optional speeds, newest first, limited", async () => {
        await store.addWifi(wifi({ quality: "poor", note: "slow", downMbps: 12.5, createdAt: iso(0) }));
        await store.addWifi(wifi({ createdAt: iso(1000) }));
        const rows = await store.listWifi(10);
        expect(rows.map((r) => r.quality)).toEqual(["good", "poor"]);
        expect(rows[1]).toMatchObject({ note: "slow", downMbps: 12.5, upMbps: null });
        expect(await store.listWifi(1)).toHaveLength(1);
      });

      it("adds, lists newest first and deletes announcements", async () => {
        const a = await store.addAnnouncement({ id: uid(), title: "Old", body: "", tag: "Office", createdAt: iso(0) });
        await store.addAnnouncement({ id: uid(), title: "New", body: "Details", tag: "Safety", createdAt: iso(1000) });
        expect((await store.listAnnouncements(10)).map((x) => x.title)).toEqual(["New", "Old"]);
        await store.deleteAnnouncement(a.id);
        await store.deleteAnnouncement("missing");
        expect((await store.listAnnouncements(10)).map((x) => x.title)).toEqual(["New"]);
      });
    });

    describe("employees", () => {
      it("creates on first sign-in, then refreshes name/picture/lastSeenAt but keeps createdAt", async () => {
        const first = await store.upsertEmployee(employee({ name: "Asha R" }));
        expect(first.createdAt).toBe(iso());
        const again = await store.upsertEmployee(employee({ name: "Asha Raj", picture: "pic", lastSeenAt: iso(60_000) }));
        expect(again.createdAt).toBe(iso());
        expect(again.name).toBe("Asha Raj");
        expect(again.picture).toBe("pic");
        expect(again.lastSeenAt).toBe(iso(60_000));
        expect(await store.getEmployee("a@innovinlabs.com")).toMatchObject({ name: "Asha Raj" });
        expect(await store.getEmployee("nobody@innovinlabs.com")).toBeNull();
      });

      it("defaults to member and grants/revokes roles", async () => {
        const created = await store.upsertEmployee(employee());
        expect(created.role).toBe("member");
        expect(await store.setRole("a@innovinlabs.com", "admin")).toBe(true);
        expect(await store.getEmployee("a@innovinlabs.com")).toMatchObject({ role: "admin" });
        expect(await store.setRole("a@innovinlabs.com", "member")).toBe(true);
        expect(await store.getEmployee("a@innovinlabs.com")).toMatchObject({ role: "member" });
        expect(await store.setRole("nobody@innovinlabs.com", "admin")).toBe(false);
      });

      // Sign-in runs upsertEmployee on every visit — it must never silently demote an admin.
      it("keeps a granted role when the person signs in again", async () => {
        await store.upsertEmployee(employee());
        await store.setRole("a@innovinlabs.com", "admin");
        const again = await store.upsertEmployee(employee({ name: "Asha Raj", role: "member", lastSeenAt: iso(60_000) }));
        expect(again.role).toBe("admin");
        expect(again.name).toBe("Asha Raj");
      });

      it("stores a joining date, clears it, and reports unknown emails", async () => {
        await store.upsertEmployee(employee());
        expect((await store.getEmployee("a@innovinlabs.com"))?.joinedOn).toBeNull();
        expect(await store.setJoinedOn("a@innovinlabs.com", "2024-06-17")).toBe(true);
        expect(await store.getEmployee("a@innovinlabs.com")).toMatchObject({ joinedOn: "2024-06-17" });
        expect(await store.setJoinedOn("a@innovinlabs.com", null)).toBe(true);
        expect((await store.getEmployee("a@innovinlabs.com"))?.joinedOn).toBeNull();
        expect(await store.setJoinedOn("nobody@innovinlabs.com", "2024-06-17")).toBe(false);
      });

      // Sign-in upserts on every visit; it must not wipe an admin-entered joining date.
      it("keeps the joining date when the person signs in again", async () => {
        await store.upsertEmployee(employee());
        await store.setJoinedOn("a@innovinlabs.com", "2024-06-17");
        const again = await store.upsertEmployee(employee({ lastSeenAt: iso(60_000) }));
        expect(again.joinedOn).toBe("2024-06-17");
      });

      it("lists employees sorted by name", async () => {
        await store.upsertEmployee(employee({ email: "z@innovinlabs.com", name: "Zara" }));
        await store.upsertEmployee(employee({ email: "a@innovinlabs.com", name: "Asha" }));
        await store.upsertEmployee(employee({ email: "b@innovinlabs.com", name: "Asha" }));
        const list = await store.listEmployees();
        expect(list.map((e) => e.email)).toEqual(["a@innovinlabs.com", "b@innovinlabs.com", "z@innovinlabs.com"]);
      });
    });

    describe("time away", () => {
      it("adds and lists newest first across leave and wfh", async () => {
        await store.addAway(away({ type: "wfh", startDate: "2026-10-07", endDate: "2026-10-07", createdAt: iso(0) }));
        await store.addAway(away({ type: "leave", reason: "family trip", createdAt: iso(1000) }));
        const rows = await store.listAway(10);
        expect(rows.map((r) => r.type)).toEqual(["leave", "wfh"]);
        expect(rows[0]).toMatchObject({ status: "pending", reason: "family trip", startDate: "2026-10-01", endDate: "2026-10-02" });
      });

      it("updates status and reports unknown ids", async () => {
        const row = await store.addAway(away());
        expect(await store.setAwayStatus(row.id, "approved", "Asha", iso(5000))).toBe(true);
        expect((await store.listAway(10))[0].status).toBe("approved");
        expect(await store.setAwayStatus("missing", "rejected", null, iso())).toBe(false);
      });

      it("records who decided a request, and leaves it unattributed for passcode admins", async () => {
        const named = await store.addAway(away({ reason: "named" }));
        await store.setAwayStatus(named.id, "approved", "Asha", iso(5000));
        expect(await store.listAway(10)).toContainEqual(
          expect.objectContaining({ id: named.id, status: "approved", decidedBy: "Asha", decidedAt: iso(5000) }),
        );

        // Break-glass PIN sessions carry no identity, so the decision stays unattributed.
        const anon = await store.addAway(away({ reason: "anon", submitterRef: "ref-9" }));
        await store.setAwayStatus(anon.id, "rejected", null, iso(6000));
        expect(await store.listAway(10)).toContainEqual(
          expect.objectContaining({ id: anon.id, status: "rejected", decidedBy: null }),
        );
      });

      it("starts requests unattributed", async () => {
        const row = await store.addAway(away());
        expect(row).toMatchObject({ decidedBy: null, decidedAt: null });
      });

      it("round-trips the leave bucket, half-day flag and charged days", async () => {
        const half = await store.addAway(away({ leaveType: "cl", halfDay: true, days: 0.5 }));
        expect(half).toMatchObject({ leaveType: "cl", halfDay: true, days: 0.5 });
        // WFH draws from no balance at all.
        const wfh = await store.addAway(away({ type: "wfh", leaveType: null, halfDay: false, days: 0 }));
        expect(wfh).toMatchObject({ type: "wfh", leaveType: null, days: 0 });
        const stored = await store.listAway(10);
        expect(stored.find((r) => r.id === half.id)).toMatchObject({ leaveType: "cl", days: 0.5 });
        expect(stored.find((r) => r.id === wfh.id)?.leaveType).toBeNull();
      });

      it("keeps each leave type distinct", async () => {
        for (const t of ["cl", "sl", "el", "fl", "ml"] as const) {
          await store.addAway(away({ leaveType: t, days: 1, reason: t }));
        }
        const rows = await store.listAway(10);
        expect(rows.map((r) => r.leaveType).sort()).toEqual(["cl", "el", "fl", "ml", "sl"]);
      });

      it("lists only the device's own requests, newest first, with a limit", async () => {
        await store.addAway(away({ reason: "one", createdAt: iso(0) }));
        await store.addAway(away({ reason: "theirs", submitterRef: "ref-2", createdAt: iso(1000) }));
        await store.addAway(away({ reason: "two", createdAt: iso(2000) }));
        await store.addAway(away({ reason: "three", createdAt: iso(3000) }));
        expect((await store.listAwayByRef("ref-1", 2)).map((r) => r.reason)).toEqual(["three", "two"]);
      });

      it("lists a verified employee's requests across all their devices", async () => {
        await store.addAway(away({ reason: "phone", createdAt: iso(0) }));
        await store.addAway(away({ reason: "laptop", submitterRef: "ref-2", createdAt: iso(1000) }));
        await store.addAway(away({ email: "other@innovinlabs.com", reason: "not mine", createdAt: iso(2000) }));
        expect((await store.listAwayByEmail("a@innovinlabs.com", 10)).map((r) => r.reason)).toEqual(["laptop", "phone"]);
        expect(await store.listAwayByEmail("nobody@innovinlabs.com", 10)).toEqual([]);
      });
    });

    describe("events & RSVPs", () => {
      it("lists only events from `from` onwards, soonest first, with a limit", async () => {
        await store.addEvent(event({ title: "past", startsAt: iso(-86_400_000) }));
        await store.addEvent(event({ title: "later", startsAt: iso(2 * 86_400_000) }));
        await store.addEvent(event({ title: "sooner", startsAt: iso(60_000) }));
        const rows = await store.listEvents(iso(), 10);
        expect(rows.map((e) => e.title)).toEqual(["sooner", "later"]);
        expect(await store.listEvents(iso(), 1)).toHaveLength(1);
      });

      it("deletes an event and its RSVPs", async () => {
        const e = await store.addEvent(event());
        expect(await store.getEvent(e.id)).toMatchObject({ title: "Match screening", category: "sports" });
        expect(await store.getEvent("missing")).toBeNull();
        await store.setRsvp(e.id, "ref-1", null, true);
        expect(await store.deleteEvent(e.id)).toBe(true);
        expect(await store.deleteEvent(e.id)).toBe(false);
        expect(await store.getEvent(e.id)).toBeNull();
        expect(await store.listEvents(iso(-1), 10)).toHaveLength(0);
        expect(await store.listRsvps(e.id)).toHaveLength(0);
      });

      it("tracks one RSVP per device per event, toggled on and off", async () => {
        const e = await store.addEvent(event());
        await store.setRsvp(e.id, "ref-1", "a@innovinlabs.com", true);
        await store.setRsvp(e.id, "ref-2", null, true);
        await store.setRsvp(e.id, "ref-1", "a@innovinlabs.com", true); // repeat = still one row
        let counts = await store.rsvpCounts([e.id]);
        expect(counts[e.id]).toBe(2);
        expect((await store.listRsvps(e.id)).find((r) => r.submitterRef === "ref-1")?.email).toBe("a@innovinlabs.com");
        expect(await store.myRsvpEventIds("ref-1")).toEqual([e.id]);

        await store.setRsvp(e.id, "ref-1", null, false);
        counts = await store.rsvpCounts([e.id]);
        expect(counts[e.id]).toBe(1);
        expect(await store.myRsvpEventIds("ref-1")).toHaveLength(0);
      });

      it("returns zero counts for events with no RSVPs", async () => {
        const e = await store.addEvent(event());
        const counts = await store.rsvpCounts([e.id, "unknown-event"]);
        expect(counts[e.id] ?? 0).toBe(0);
        expect(counts["unknown-event"] ?? 0).toBe(0);
      });
    });

    describe("concurrency", () => {
      it("never loses writes under parallel requests", async () => {
        await Promise.all(Array.from({ length: 25 }, (_, i) => store.addGrievance(grievance({ body: `g${i}` }))));
        expect(await store.listGrievances()).toHaveLength(25);
      });

      it("keeps one consistent selection when a device saves in parallel", async () => {
        await Promise.all([
          store.setDayOrders("2026-09-23", "ref-1", [order({ itemId: "tea" })]),
          store.setDayOrders("2026-09-23", "ref-1", [order({ itemId: "tea" }), order({ itemId: "lunch" })]),
        ]);
        const rows = await store.listOrders("2026-09-23");
        expect(rows.every((o) => o.submitterRef === "ref-1")).toBe(true);
        // Whichever save won, the result is a complete selection — never a merge of both.
        expect([1, 2]).toContain(rows.length);
      });

      it("checks in once even when the same email checks in in parallel", async () => {
        await Promise.all(Array.from({ length: 5 }, () => store.checkIn(attendance())));
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);
      });
    });
  });
}
