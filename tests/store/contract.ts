import { beforeEach, describe, expect, it } from "vitest";
import type { AttendanceRow, AwayRow, EmployeeRow, EventRow, GrievanceRow, StepsRow, Store, WifiRow } from "@/lib/types";

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

    it("does not add RSVP to a cancelled or deleted event even through a stale caller",async()=>{
      const e=await store.addEvent({id:uid(),title:"Cancelled",body:"",category:"social",startsAt:iso(86400000),location:"",createdBy:"owner",createdAt:iso()});
      await store.updateEvent(e.id,e.createdAt,{...e,cancelledAt:iso(1000)},iso(1000));
      expect(await store.setRsvp(e.id,"late","late@innovinlabs.com",true)).toBe(false);
      expect(await store.listRsvps(e.id)).toEqual([]);
      await store.deleteEvent(e.id);
      expect(await store.setRsvp(e.id,"late",null,true)).toBe(false);
    });

    it("lets a creator correct an event without losing RSVPs and rejects stale edits/deletes", async () => {
      const event = await store.addEvent({id:uid(),title:"Original",body:"",category:"social",startsAt:iso(86400000),location:"Studio",createdBy:"creator@innovinlabs.com",createdAt:iso()});
      await store.setRsvp(event.id,"guest",null,true);
      const patch={title:"Corrected",body:"New details",category:"learning" as const,startsAt:iso(86400000),location:"Room 2"};
      expect(await store.updateEvent(event.id,event.createdAt,patch,iso(1000))).toMatchObject({...patch,createdBy:event.createdBy,updatedAt:iso(1000)});
      expect(await store.updateEvent(event.id,event.createdAt,patch,iso(2000))).toBeNull();
      expect(await store.rsvpCounts([event.id])).toEqual({[event.id]:1});
      expect(await store.deleteEvent(event.id,event.createdAt)).toBe(false);
      expect(await store.deleteEvent(event.id,iso(1000))).toBe(true);
    });

    it("persists public notes while discarding anonymous authors and toggling one reaction per employee", async () => {
      const note = await store.addNotice({ id: uid(), kind: "quote", title: "", body: "Make things that matter", attribution: "", color: "yellow", anonymous: true, authorEmail: "a@innovinlabs.com", authorName: "Asha", createdAt: iso() });
      expect(note.authorEmail).toBeNull();
      expect(note.authorName).toBeNull();
      await store.addNotice({ ...note, id: uid(), anonymous: false, authorEmail: "b@innovinlabs.com", authorName: "Ben", createdAt: iso(1000) });
      const rows = await store.listNotices(20);
      expect(rows).toHaveLength(2);
      expect(rows[0].authorName).toBe("Ben");
      expect(await store.toggleNoticeReaction(note.id, "b@innovinlabs.com", "❤️")).toBe(true);
      expect(await store.toggleNoticeReaction(note.id, "c@innovinlabs.com", "❤️")).toBe(true);
      expect(await store.listNoticeReactions([note.id])).toHaveLength(2);
      await store.toggleNoticeReaction(note.id, "b@innovinlabs.com", "❤️");
      expect(await store.listNoticeReactions([note.id])).toEqual([{ noticeId: note.id, email: "c@innovinlabs.com", emoji: "❤️" }]);
      expect(await store.toggleNoticeReaction("missing", "b@innovinlabs.com", "❤️")).toBe(false);
      expect(await store.deleteNotice(note.id)).toBe(true);
      expect(await store.listNoticeReactions([note.id])).toEqual([]);
      expect(await store.deleteNotice(note.id)).toBe(false);
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
    const grievance = (p: Partial<GrievanceRow> = {}): GrievanceRow => ({
      id: uid(),
      body: "Issue",
      displayName: null,
      image: null,
      urgent: false,
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
      stepsOffset: 0,
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

    describe("workspace", () => {
      it("merges profile edits without losing presence and isolates colleagues", async () => {
        await store.saveWorkspaceProfile("a@innovinlabs.com", { designation: "Product Designer", mode: "office", presenceDate: "2026-10-15" });
        await store.saveWorkspaceProfile("a@innovinlabs.com", { desk: "B12", project: "Portal" });
        expect(await store.getWorkspaceProfile("a@innovinlabs.com")).toMatchObject({ designation: "Product Designer", desk: "B12", mode: "office" });
        expect(await store.getWorkspaceProfile("b@innovinlabs.com")).toBeNull();
        expect(await store.listWorkspaceProfiles()).toHaveLength(1);
      });

      it("replaces a person's planner day, ranges by date and clears only their own day", async () => {
        await store.setPlannerDay({ email: "a@innovinlabs.com", date: "2026-10-15", kind: "office" });
        await store.setPlannerDay({ email: "a@innovinlabs.com", date: "2026-10-15", kind: "vacation" });
        await store.setPlannerDay({ email: "b@innovinlabs.com", date: "2026-10-15", kind: "remote" });
        await store.setPlannerDay({ email: "a@innovinlabs.com", date: "2026-11-01", kind: "sick" });
        expect(await store.listPlannerDays("a@innovinlabs.com", "2026-10-01", "2026-10-31")).toEqual([{ email: "a@innovinlabs.com", date: "2026-10-15", kind: "vacation" }]);
        await store.deletePlannerDay("a@innovinlabs.com", "2026-10-15");
        expect(await store.listPlannerDays("a@innovinlabs.com", "2026-10-01", "2026-10-31")).toEqual([]);
        expect(await store.listPlannerDays("b@innovinlabs.com", "2026-10-01", "2026-10-31")).toHaveLength(1);
      });
    });

    describe("attendance", () => {
      it("keeps one row per person per day: repeat check-in is a no-op, check-in after checkout reopens it", async () => {
        const first = await store.checkIn(attendance());
        const again = await store.checkIn(attendance({ checkInAt: iso(60_000) }));
        expect(again.id).toBe(first.id);
        expect(again.checkInAt).toBe(first.checkInAt);
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);

        await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(3_600_000));
        const reopened = await store.checkIn(attendance({ checkInAt: iso(4_000_000) }));
        // Same row — back in means in again, and the day still has exactly one record.
        expect(reopened.id).toBe(first.id);
        expect(reopened.checkInAt).toBe(iso(4_000_000));
        expect(reopened.checkOutAt).toBeNull();
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);
      });

      it("getAttendance returns the day's row in either state; checkOut closes it once", async () => {
        const row = await store.checkIn(attendance());
        expect((await store.getAttendance("a@innovinlabs.com", "2026-09-23"))?.id).toBe(row.id);
        expect(await store.getAttendance("b@innovinlabs.com", "2026-09-23")).toBeNull();
        const out = await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(3_600_000));
        expect(out?.checkOutAt).toBe(iso(3_600_000));
        expect(await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(4_000_000))).toBeNull();
        expect(await store.checkOut("nobody@innovinlabs.com", "2026-09-23", iso())).toBeNull();
        // The row still exists — checked out, not gone.
        expect((await store.getAttendance("a@innovinlabs.com", "2026-09-23"))?.checkOutAt).toBe(iso(3_600_000));
      });

      it("round-trips the check-in location, defaulting to null", async () => {
        await store.checkIn(attendance({ email: "loc@innovinlabs.com", lat: 12.935, lng: 77.624, accuracyM: 18 }));
        await store.checkIn(attendance({ email: "noloc@innovinlabs.com" }));
        const rows = await store.listAttendance("2026-09-23");
        expect(rows.find((r) => r.email === "loc@innovinlabs.com")).toMatchObject({ lat: 12.935, lng: 77.624, accuracyM: 18 });
        expect(rows.find((r) => r.email === "noloc@innovinlabs.com")).toMatchObject({ lat: null, lng: null, accuracyM: null });
      });

      it("lists one day ordered by check-in time, one row per person", async () => {
        await store.checkIn(attendance({ email: "late@innovinlabs.com", checkInAt: iso(120_000) }));
        await store.checkIn(attendance({ email: "early@innovinlabs.com", checkInAt: iso(0) }));
        await store.checkIn(attendance({ email: "other-day@innovinlabs.com", date: "2026-09-22" }));
        const rows = await store.listAttendance("2026-09-23");
        expect(rows.map((r) => r.email)).toEqual(["early@innovinlabs.com", "late@innovinlabs.com"]);
        expect(await store.getAttendance("early@innovinlabs.com", "2026-09-22")).toBeNull();
      });

      it("lists one person's days across a date range, one row per day", async () => {
        await store.checkIn(attendance({ date: "2026-09-01", checkInAt: iso(1000) }));
        await store.checkIn(attendance({ date: "2026-09-15", checkInAt: iso(2000) }));
        await store.checkOut("a@innovinlabs.com", "2026-09-15", iso(3000));
        // Re-checking in the same day folds into the same row, not a second one.
        await store.checkIn(attendance({ date: "2026-09-15", checkInAt: iso(5000) }));
        await store.checkIn(attendance({ date: "2026-09-30", checkInAt: iso(9000) }));
        await store.checkIn(attendance({ date: "2026-10-01", checkInAt: iso(9999) })); // outside
        await store.checkIn(attendance({ email: "other@innovinlabs.com", date: "2026-09-15" })); // someone else

        const rows = await store.listAttendanceRange("a@innovinlabs.com", "2026-09-01", "2026-09-30");
        expect(rows.map((r) => r.date)).toEqual(["2026-09-01", "2026-09-15", "2026-09-30"]);
        // The reopened day shows the latest check-in and is open again.
        expect(rows[1].checkInAt).toBe(iso(5000));
        expect(rows[1].checkOutAt).toBeNull();
        // The range is inclusive on both ends, and empty ranges are empty.
        expect(await store.listAttendanceRange("a@innovinlabs.com", "2026-09-15", "2026-09-15")).toHaveLength(1);
        expect(await store.listAttendanceRange("a@innovinlabs.com", "2026-08-01", "2026-08-31")).toEqual([]);
        expect(await store.listAttendanceRange("nobody@innovinlabs.com", "2026-09-01", "2026-09-30")).toEqual([]);
      });
    });

    describe("steps", () => {
      const steps = (p: Partial<StepsRow> = {}): StepsRow => ({
        id: uid(),
        email: "a@innovinlabs.com",
        date: "2026-09-23",
        hit: true,
        steps: null,
        createdAt: iso(),
        ...p,
      });

      it("upserts one row per person per day", async () => {
        await store.setSteps(steps({ steps: 9_500, hit: false }));
        const again = await store.setSteps(steps({ steps: 12_400, hit: true }));
        expect(again.steps).toBe(12_400);
        expect(again.hit).toBe(true);
        const all = await store.listSteps();
        expect(all).toHaveLength(1);
        expect(all[0].steps).toBe(12_400);
      });

      it("lists everyone newest day first, and one person's history with a limit", async () => {
        await store.setSteps(steps({ date: "2026-09-22" }));
        await store.setSteps(steps({ date: "2026-09-23", createdAt: iso(1000) }));
        await store.setSteps(steps({ email: "b@innovinlabs.com", date: "2026-09-23", hit: false }));
        const all = (await store.listSteps()).map((s) => `${s.email}:${s.date}`);
        // Same-date order between people is unspecified; the day ordering is not.
        expect(all.slice(0, 2).sort()).toEqual(["a@innovinlabs.com:2026-09-23", "b@innovinlabs.com:2026-09-23"]);
        expect(all[2]).toBe("a@innovinlabs.com:2026-09-22");
        const mine = await store.listStepsByEmail("a@innovinlabs.com", 1);
        expect(mine.map((s) => s.date)).toEqual(["2026-09-23"]);
      });

      it("legacy owner rows read back as admin", async () => {
        await store.upsertEmployee(employee({ email: "o@innovinlabs.com", role: "owner" as never }));
        expect((await store.getEmployee("o@innovinlabs.com"))!.role).toBe("admin");
        expect((await store.listEmployees()).find((e) => e.email === "o@innovinlabs.com")!.role).toBe("admin");
      });

      it("keeps a steps offset on the employee", async () => {
        expect(await store.setStepsOffset("ghost@innovinlabs.com", 10)).toBe(false);
        await store.upsertEmployee(employee());
        expect(await store.setStepsOffset("a@innovinlabs.com", 45)).toBe(true);
        expect((await store.getEmployee("a@innovinlabs.com"))?.stepsOffset).toBe(45);
        // A re-sign-in (upsert) must not wipe the admin-entered offset.
        await store.upsertEmployee(employee({ name: "Asha Renamed" }));
        expect((await store.getEmployee("a@innovinlabs.com"))?.stepsOffset).toBe(45);
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

      it("sorts urgent above normal, then newest first", async () => {
        await store.addGrievance(grievance({ body: "old normal", createdAt: iso(0) }));
        await store.addGrievance(grievance({ body: "urgent but oldest", urgent: true, createdAt: iso(500) }));
        await store.addGrievance(grievance({ body: "new normal", createdAt: iso(3000) }));
        await store.addGrievance(grievance({ body: "urgent newest", urgent: true, createdAt: iso(2000) }));
        expect((await store.listGrievances()).map((g) => g.body)).toEqual([
          "urgent newest",
          "urgent but oldest",
          "new normal",
          "old normal",
        ]);
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

      it("keeps a signed-in employee's RSVP unique across devices and recognizes legacy references", async () => {
        const e = await store.addEvent(event());
        await store.setRsvp(e.id, "device-a", "a@innovinlabs.com", true);
        expect(await store.myRsvpEventIds("account-a", "a@innovinlabs.com")).toContain(e.id);
        await store.setRsvp(e.id, "account-a", "a@innovinlabs.com", true);
        expect((await store.rsvpCounts([e.id]))[e.id]).toBe(1);
        await store.setRsvp(e.id, "another-device", "a@innovinlabs.com", false);
        expect((await store.rsvpCounts([e.id]))[e.id] ?? 0).toBe(0);
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
        expect(await store.getAnnouncement(a.id)).toMatchObject({title:"Old"});
        expect(await store.getAnnouncement("missing")).toBeNull();
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

      it("stores Zoho leave balances per person per year, upserting and keeping types optional", async () => {
        const row = {
          email: "a@innovinlabs.com",
          year: 2026,
          available: { cl: 3.5, sl: 5, el: 21, fl: 1 },
          asOf: iso(),
          updatedBy: "Asha",
        };
        expect(await store.setLeaveBalance(row)).toMatchObject({ available: { cl: 3.5, el: 21 }, updatedBy: "Asha" });

        // Second write for the same person/year replaces the first.
        await store.setLeaveBalance({ ...row, available: { cl: 2 }, asOf: iso(1000), updatedBy: "Bala" });
        const [stored] = await store.listLeaveBalances(2026);
        expect(stored).toMatchObject({ email: "a@innovinlabs.com", available: { cl: 2 }, updatedBy: "Bala" });
        // Types left out are absent, not zero — an admin can decline to assert a number.
        expect(stored.available.sl).toBeUndefined();
        expect(stored.asOf).toBe(iso(1000));

        await store.setLeaveBalance({ ...row, email: "b@innovinlabs.com", available: { sl: 4 } });
        expect(await store.listLeaveBalances(2026)).toHaveLength(2);
        expect(await store.listLeaveBalances(2027)).toEqual([]);
      });

      it("saves push subscriptions by endpoint, scopes them by email, and prunes them", async () => {
        const sub = (p: Partial<{ endpoint: string; email: string | null }> = {}) => ({
          endpoint: "https://push.example.com/a",
          p256dh: "key",
          auth: "auth",
          email: "a@innovinlabs.com" as string | null,
          createdAt: iso(),
          ...p,
        });
        await store.savePushSubscription(sub());
        // Re-subscribing the same browser refreshes the row rather than duplicating it.
        await store.savePushSubscription(sub({ email: "b@innovinlabs.com" }));
        expect(await store.listPushSubscriptions()).toHaveLength(1);
        expect((await store.listPushSubscriptions())[0].email).toBe("b@innovinlabs.com");

        await store.savePushSubscription(sub({ endpoint: "https://push.example.com/b", email: null }));
        expect(await store.listPushSubscriptions()).toHaveLength(2);
        // An email narrows to that person's devices; no email means a broadcast list.
        expect(await store.listPushSubscriptions("b@innovinlabs.com")).toHaveLength(1);
        expect(await store.listPushSubscriptions("nobody@innovinlabs.com")).toEqual([]);

        expect(await store.deletePushSubscription("https://push.example.com/a")).toBe(true);
        expect(await store.deletePushSubscription("https://push.example.com/a")).toBe(false);
        expect(await store.listPushSubscriptions()).toHaveLength(1);
      });

      it("lists employees sorted by name", async () => {
        await store.upsertEmployee(employee({ email: "z@innovinlabs.com", name: "Zara" }));
        await store.upsertEmployee(employee({ email: "a@innovinlabs.com", name: "Asha" }));
        await store.upsertEmployee(employee({ email: "b@innovinlabs.com", name: "Asha" }));
        const list = await store.listEmployees();
        expect(list.map((e) => e.email)).toEqual(["a@innovinlabs.com", "b@innovinlabs.com", "z@innovinlabs.com"]);
      });
    });

    it("keeps explicit presence consistent across repeat check-ins and reopening", async () => {
      const row = attendance({ declaredMode: "office" });
      await store.checkIn(row);
      const switched = await store.checkIn({ ...row, declaredMode: "remote", checkInAt: iso(5000) });
      expect(switched).toMatchObject({ declaredMode: "remote", checkInAt: row.checkInAt });
      expect(await store.checkIn({ ...row, declaredMode: null })).toMatchObject({ declaredMode: null });
      await store.checkOut(row.email, row.date, iso(6000));
      await store.checkIn({ ...row, declaredMode: null, checkInAt: iso(7000) });
      expect(await store.getAttendance(row.email, row.date)).toMatchObject({ declaredMode: null, checkOutAt: null });
    });

    it("revokes only the signing-out session's push subscriptions", async () => {
      const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "key", auth: "auth", email: "a@innovinlabs.com", createdAt: iso(), sessionRef: "session-a", sessionExpiresAt: iso(99999) };
      await store.savePushSubscription(sub);
      await store.savePushSubscription({ ...sub, endpoint: sub.endpoint + "b", sessionRef: "session-b" });
      await store.revokePushSession("session-a");
      expect((await store.listPushSubscriptions()).map(s => s.sessionRef)).toEqual(["session-b"]);
    });

    describe("time away", () => {
      it("commits only one competing leave decision and keeps older pending work actionable", async () => {
        const row = await store.addAway(away());
        await store.addAway(away({ status: "rejected", createdAt: iso(1000) }));
        expect((await store.listPendingAway()).map(r => r.id)).toEqual([row.id]);
        const results = await Promise.all([
          store.setAwayStatus(row.id, "approved", "Admin", iso(5000), "pending"),
          store.setAwayStatus(row.id, "cancelled", null, iso(5000), "pending"),
        ]);
        expect(results.filter(Boolean)).toHaveLength(1);
        expect((await store.getAway(row.id))?.status).toBe(results[0] ? "approved" : "cancelled");
      });

      it("adds and lists newest first across leave and wfh", async () => {
        await store.addAway(away({ type: "wfh", startDate: "2026-10-07", endDate: "2026-10-07", createdAt: iso(0) }));
        await store.addAway(away({ type: "leave", reason: "family trip", createdAt: iso(1000) }));
        const rows = await store.listAway(10);
        expect(rows.map((r) => r.type)).toEqual(["leave", "wfh"]);
        expect(rows[0]).toMatchObject({ status: "pending", reason: "family trip", startDate: "2026-10-01", endDate: "2026-10-02" });
      });

      it("keeps a signed-in employee's RSVP unique across devices and recognizes legacy references", async () => {
        const e = await store.addEvent(event());
        await store.setRsvp(e.id, "device-a", "a@innovinlabs.com", true);
        expect(await store.myRsvpEventIds("account-a", "a@innovinlabs.com")).toContain(e.id);
        await store.setRsvp(e.id, "account-a", "a@innovinlabs.com", true);
        expect((await store.rsvpCounts([e.id]))[e.id]).toBe(1);
        await store.setRsvp(e.id, "another-device", "a@innovinlabs.com", false);
        expect((await store.rsvpCounts([e.id]))[e.id] ?? 0).toBe(0);
      });

      it("updates status and reports unknown ids", async () => {
        const row = await store.addAway(away());
        expect(await store.setAwayStatus(row.id, "approved", "Asha", iso(5000), "pending")).toBe(true);
        expect((await store.listAway(10))[0].status).toBe("approved");
        expect(await store.setAwayStatus("missing", "rejected", null, iso(), "pending")).toBe(false);
      });

      it("records who decided a request, and leaves it unattributed for passcode admins", async () => {
        const named = await store.addAway(away({ reason: "named" }));
        await store.setAwayStatus(named.id, "approved", "Asha", iso(5000), "pending");
        expect(await store.listAway(10)).toContainEqual(
          expect.objectContaining({ id: named.id, status: "approved", decidedBy: "Asha", decidedAt: iso(5000) }),
        );

        // Break-glass PIN sessions carry no identity, so the decision stays unattributed.
        const anon = await store.addAway(away({ reason: "anon", submitterRef: "ref-9" }));
        await store.setAwayStatus(anon.id, "rejected", null, iso(6000), "pending");
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

      it("checks in once even when the same email checks in in parallel", async () => {
        await Promise.all(Array.from({ length: 5 }, () => store.checkIn(attendance())));
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);
      });
    });
  });
}
