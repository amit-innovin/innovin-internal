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

    it("moves a person's feed watermark forward only", async () => {
      await store.upsertEmployee(employee({ email: "a@innovinlabs.com" }));
      expect((await store.getEmployee("a@innovinlabs.com"))?.feedSeenAt ?? null).toBeNull();
      await store.setFeedSeenAt("a@innovinlabs.com", iso(60_000));
      await store.setFeedSeenAt("a@innovinlabs.com", iso());
      expect((await store.getEmployee("a@innovinlabs.com"))?.feedSeenAt).toBe(iso(60_000));
      await store.setFeedSeenAt("a@innovinlabs.com", iso(120_000));
      expect((await store.getEmployee("a@innovinlabs.com"))?.feedSeenAt).toBe(iso(120_000));
    });

    it("keeps important announcements and counts each person's acknowledgement once", async () => {
      await store.addAnnouncement({ id: "plain", title: "Parking", body: "", tag: "general", createdAt: iso() });
      await store.addAnnouncement({ id: "imp", title: "Office closed", body: "Maintenance", tag: "general", createdAt: iso(1000), important: true, authorName: "Anita", pinnedUntil: "2026-11-27" });
      const [imp, plain] = await store.listAnnouncements(10);
      expect(imp).toMatchObject({ id: "imp", important: true, authorName: "Anita", pinnedUntil: "2026-11-27" });
      expect(plain).toMatchObject({ id: "plain", important: false, authorName: null, pinnedUntil: null });
      await store.ackAnnouncement("imp", "a@innovinlabs.com");
      await store.ackAnnouncement("imp", "a@innovinlabs.com");
      await store.ackAnnouncement("imp", "b@innovinlabs.com");
      expect(await store.listAckedAnnouncementIds("a@innovinlabs.com")).toEqual(["imp"]);
      expect(await store.listAckedAnnouncementIds("c@innovinlabs.com")).toEqual([]);
      expect(await store.countAnnouncementAcks(["imp", "plain"])).toEqual({ imp: 2, plain: 0 });
      // Someone marked as left no longer counts as a reader.
      await store.upsertEmployee(employee({ email: "b@innovinlabs.com" }));
      await store.setLeftOn("b@innovinlabs.com", "2026-11-18");
      expect(await store.countAnnouncementAcks(["imp"])).toEqual({ imp: 1 });
    });

    it("keeps one tea answer per person, round and day, including a skip", async () => {
      await store.setTeaAnswer("2026-11-18", "am", "a@innovinlabs.com", true);
      await store.setTeaAnswer("2026-11-18", "pm", "a@innovinlabs.com", false);
      await store.setTeaAnswer("2026-11-18", "am", "b@innovinlabs.com", true);
      await store.setTeaAnswer("2026-11-18", "am", "b@innovinlabs.com", null);
      const rows = (await store.listTeaAnswers("2026-11-18")).map(({ round, email, going }) => ({ round, email, going }));
      expect(rows.sort((x, y) => x.round.localeCompare(y.round))).toEqual([
        { round: "am", email: "a@innovinlabs.com", going: true },
        { round: "pm", email: "a@innovinlabs.com", going: false },
      ]);
    });

    it("reads tea from before rounds as an afternoon yes", async () => {
      await store.setTea("2026-11-17", "c@innovinlabs.com", true);
      expect((await store.listTeaAnswers("2026-11-17")).map(({ round, email, going }) => ({ round, email, going }))).toEqual([{ round: "pm", email: "c@innovinlabs.com", going: true }]);
      expect((await store.listTea("2026-11-17")).map((t) => t.email)).toEqual(["c@innovinlabs.com"]);
    });

    it("keeps one snack pick per person per day, and switching replaces it", async () => {
      await store.setSnackPick("2026-11-18", "ref-a", "samosa");
      await store.setSnackPick("2026-11-18", "ref-a", "fruit");
      await store.setSnackPick("2026-11-18", "ref-b", "fruit");
      await store.setSnackPick("2026-11-19", "ref-a", "samosa");
      expect((await store.listSnackPicks("2026-11-18")).sort((x, y) => x.voterRef.localeCompare(y.voterRef))).toEqual([{ itemId: "fruit", voterRef: "ref-a" }, { itemId: "fruit", voterRef: "ref-b" }]);
      await store.setSnackPick("2026-11-18", "ref-a", null);
      expect(await store.listSnackPicks("2026-11-18")).toEqual([{ itemId: "fruit", voterRef: "ref-b" }]);
    });

    it("records a snack order once and restores the original timestamps on undo", async () => {
      const date = "2026-11-18";
      const previous = "2026-11-17T08:00:00.000Z";
      const at = `${date}T08:00:00.000Z`;
      await store.addSnack({ id: "samosa", name: "Samosa", note: "", status: "shelf", orderedAt: previous, createdAt: previous });
      await store.addSnack({ id: "fruit", name: "Fruit", note: "", status: "shelf", orderedAt: null, createdAt: previous });
      await store.setSnackPick(date, "ref-a", "samosa");
      await store.setSnackPick(date, "ref-b", "fruit");
      await store.setSnackOrder(date, at);
      await Promise.all([store.setSnackOrder(date, `${date}T09:00:00.000Z`), store.setSnackOrder(date, `${date}T10:00:00.000Z`)]);
      expect((await store.getSnack("samosa"))?.orderedAt).toBe(at);
      await store.setSnackOrder(date, null);
      await store.setSnackOrder(date, null);
      expect((await store.getSnack("samosa"))?.orderedAt).toBe(previous);
      expect((await store.getSnack("fruit"))?.orderedAt).toBeNull();
    });

    it("stores settings by key", async () => {
      expect(await store.getSetting("snackTea")).toBeNull();
      await store.setSetting("snackTea", { orderAt: "12:30" });
      await store.setSetting("snackTea", { orderAt: "13:00" });
      expect(await store.getSetting("snackTea")).toEqual({ orderAt: "13:00" });
    });

    it("keeps the step league opt-in and a nudge once a day per direction", async () => {
      await store.upsertEmployee(employee({ email: "a@innovinlabs.com" }));
      expect((await store.getEmployee("a@innovinlabs.com"))?.stepsLeague).toBe(false);
      expect(await store.setStepsLeague("a@innovinlabs.com", true)).toBe(true);
      expect((await store.getEmployee("a@innovinlabs.com"))?.stepsLeague).toBe(true);
      expect(await store.setStepsLeague("nobody@innovinlabs.com", true)).toBe(false);
      expect(await store.addNudge("2026-11-18", "a@innovinlabs.com", "b@innovinlabs.com")).toBe(true);
      expect(await store.addNudge("2026-11-18", "a@innovinlabs.com", "b@innovinlabs.com")).toBe(false);
      expect(await store.addNudge("2026-11-18", "b@innovinlabs.com", "a@innovinlabs.com")).toBe(true);
      expect(await store.addNudge("2026-11-19", "a@innovinlabs.com", "b@innovinlabs.com")).toBe(true);
      expect(await store.listNudgesFrom("2026-11-18", "a@innovinlabs.com")).toEqual(["b@innovinlabs.com"]);
      expect(await store.listNudgesFrom("2026-11-18", "c@innovinlabs.com")).toEqual([]);
    });

    it("adds steps to today's total in one step, capped, and decides the 10K", async () => {
      expect(await store.addSteps("a@innovinlabs.com", "2026-11-18", 6000)).toEqual({ steps: 6000, hit: false });
      const [x, y] = await Promise.all([store.addSteps("a@innovinlabs.com", "2026-11-18", 3000), store.addSteps("a@innovinlabs.com", "2026-11-18", 4000)]);
      expect(Math.max(x.steps, y.steps)).toBe(13000);
      const row = (await store.listSteps()).find((r) => r.email === "a@innovinlabs.com" && r.date === "2026-11-18");
      expect(row).toMatchObject({ steps: 13000, hit: true });
      expect(await store.addSteps("a@innovinlabs.com", "2026-11-18", 199_999)).toEqual({ steps: 200_000, hit: true });
    });

    it("keeps a 10K marked with the toggle when the step counter adds a few steps", async () => {
      await store.setSteps({ id: uid(), email: "t@innovinlabs.com", date: "2026-11-18", hit: true, steps: null, createdAt: iso() });
      expect(await store.addSteps("t@innovinlabs.com", "2026-11-18", 500)).toEqual({ steps: 500, hit: true });
      const row = (await store.listSteps()).find((r) => r.email === "t@innovinlabs.com" && r.date === "2026-11-18");
      expect(row).toMatchObject({ steps: 500, hit: true });
    });

    it("keeps where a Wi-Fi report came from", async () => {
      await store.addWifi({ id: uid(), quality: "poor", note: "", downMbps: 3, upMbps: 1, createdAt: iso(), area: "Pantry" });
      expect((await store.listWifi(5))[0]).toMatchObject({ quality: "poor", area: "Pantry" });
    });

    it("keeps a Speak up message's topic and an admin's reply", async () => {
      const g = await store.addGrievance({ id: uid(), body: "The pantry tap leaks", displayName: null, image: null, urgent: false, submitterRef: "x", status: "open", createdAt: iso(), topic: "Facilities", reply: null });
      expect(g).toMatchObject({ topic: "Facilities", reply: null });
      expect(await store.setGrievanceReply(g.id, "Plumber booked for Friday")).toBe(true);
      expect(await store.setGrievanceReply("missing", "x")).toBe(false);
      expect((await store.listGrievancesByIds([g.id], 5))[0]).toMatchObject({ topic: "Facilities", reply: "Plumber booked for Friday" });
    });

    it("counts each person's report of a post once", async () => {
      expect(await store.addNoticeReport("n1", "ref-a")).toBe(true);
      expect(await store.addNoticeReport("n1", "ref-a")).toBe(false);
      expect(await store.addNoticeReport("n1", "ref-b")).toBe(true);
      expect(await store.addNoticeReport("n2", "ref-a")).toBe(true);
      expect(await store.countNoticeReports()).toEqual({ n1: 2, n2: 1 });
      await store.clearNoticeReports("n1");
      expect(await store.countNoticeReports()).toEqual({ n2: 1 });
    });

    it("keeps Say hi opt-in and today's waves, invites and replies", async () => {
      await store.upsertEmployee(employee({ email: "a@innovinlabs.com" }));
      expect((await store.getEmployee("a@innovinlabs.com"))?.sayHi).toBe(false);
      expect(await store.setSayHi("a@innovinlabs.com", true)).toBe(true);
      expect((await store.getEmployee("a@innovinlabs.com"))?.sayHi).toBe(true);
      const at = iso();
      await store.addHi({ id: "h1", date: "2026-11-18", from: "a@innovinlabs.com", to: "b@innovinlabs.com", kind: "wave", atTime: null, reply: null, createdAt: at }, 10);
      await store.addHi({ id: "h2", date: "2026-11-18", from: "a@innovinlabs.com", to: "c@innovinlabs.com", kind: "chai", atTime: "now", reply: null, createdAt: iso(1000) }, 10);
      await store.addHi({ id: "h3", date: "2026-11-17", from: "a@innovinlabs.com", to: "b@innovinlabs.com", kind: "wave", atTime: null, reply: null, createdAt: iso(-86_400_000) }, 10);
      expect((await store.listHiFrom("2026-11-18", "a@innovinlabs.com")).map((h) => h.id).sort()).toEqual(["h1", "h2"]);
      expect((await store.listHiTo("2026-11-18", "c@innovinlabs.com")).map((h) => h.id)).toEqual(["h2"]);
      expect(await store.setHiReply("h2", "b@innovinlabs.com", "yes")).toBe(false); // not the recipient
      expect(await store.setHiReply("h1", "b@innovinlabs.com", "yes")).toBe(false); // a wave isn't an invite
      expect(await store.setHiReply("h2", "c@innovinlabs.com", "yes")).toBe(true);
      expect(await store.setHiReply("h2", "c@innovinlabs.com", "no")).toBe(false); // one reply
      expect((await store.listHiFrom("2026-11-18", "a@innovinlabs.com")).find((h) => h.id === "h2")?.reply).toBe("yes");
    });

    it("adds a Say hi only under the daily limit and once per person, and dates a reply", async () => {
      const hi = (id: string, to: string) => ({ id, date: "2026-11-18", from: "a@innovinlabs.com", to, kind: "chai" as const, atTime: "now", reply: null, createdAt: iso() });
      expect(await store.addHi(hi("x1", "b@innovinlabs.com"), 3)).not.toBeNull();
      expect(await store.addHi(hi("x2", "b@innovinlabs.com"), 3)).toBeNull(); // same person again
      const [p, q, r] = await Promise.all([store.addHi(hi("x3", "c@innovinlabs.com"), 3), store.addHi(hi("x4", "d@innovinlabs.com"), 3), store.addHi(hi("x5", "e@innovinlabs.com"), 3)]);
      expect([p, q, r].filter(Boolean)).toHaveLength(2); // the limit holds when sends race
      expect(await store.listHiFrom("2026-11-18", "a@innovinlabs.com")).toHaveLength(3);
      expect(await store.setHiReply("x1", "b@innovinlabs.com", "yes")).toBe(true);
      const answered = (await store.listHiFrom("2026-11-18", "a@innovinlabs.com")).find((h) => h.id === "x1");
      expect(answered?.repliedAt).toBeTruthy();
    });

    it("keeps one plan override per person and date, and lists a date's overrides for everyone", async () => {
      await store.setPlanOverride("a@innovinlabs.com", "2026-11-18", true);
      await store.setPlanOverride("a@innovinlabs.com", "2026-11-18", false);
      await store.setPlanOverride("a@innovinlabs.com", "2026-11-19", true);
      await store.setPlanOverride("b@innovinlabs.com", "2026-11-18", true);
      expect(await store.listPlanOverrides("a@innovinlabs.com", "2026-11-01", "2026-11-30")).toEqual([
        { email: "a@innovinlabs.com", date: "2026-11-18", planned: false },
        { email: "a@innovinlabs.com", date: "2026-11-19", planned: true },
      ]);
      expect(await store.listPlanOverrides("a@innovinlabs.com", "2026-11-19", "2026-11-19")).toHaveLength(1);
      expect((await store.listPlanOverridesOn("2026-11-18")).map((r) => r.email).sort()).toEqual(["a@innovinlabs.com", "b@innovinlabs.com"]);
      await store.setPlanOverride("a@innovinlabs.com", "2026-11-18", null);
      expect(await store.listPlanOverridesOn("2026-11-18")).toEqual([{ email: "b@innovinlabs.com", date: "2026-11-18", planned: true }]);
    });

    it("keeps one sealed calendar token per admin and deletes it", async () => {
      const row = { email: "a@innovinlabs.com", ciphertext: "c1", iv: "i1", tag: "t1", kid: "k1", scope: "s", createdAt: iso() };
      expect(await store.getCalendarToken(row.email)).toBeNull();
      await store.saveCalendarToken(row);
      await store.saveCalendarToken({ ...row, ciphertext: "c2", createdAt: iso(1000) });
      expect(await store.getCalendarToken(row.email)).toEqual({ ...row, ciphertext: "c2", createdAt: iso(1000) });
      await store.saveCalendarToken({ ...row, email: "b@innovinlabs.com", createdAt: iso(500) });
      expect((await store.listCalendarTokens()).map((t) => t.email)).toEqual(["b@innovinlabs.com", "a@innovinlabs.com"]);
      expect(await store.deleteCalendarToken(row.email)).toBe(true);
      expect(await store.deleteCalendarToken(row.email)).toBe(false);
      expect(await store.getCalendarToken(row.email)).toBeNull();
    });

    it("keeps one Google invite record per event", async () => {
      const row = { eventId: "e1", owner: "a@innovinlabs.com", googleId: "abc123", generation: 0, state: "sent" as const, error: null, updatedAt: iso() };
      await store.setEventInvite(row);
      await store.setEventInvite({ ...row, state: "orphaned", updatedAt: iso(1) });
      expect(await store.getEventInvite("e1")).toEqual({ ...row, state: "orphaned", updatedAt: iso(1) });
      await store.setEventInvite({ ...row, eventId: "e2", state: "failed", error: "not-connected" });
      expect((await store.listEventInvites()).map((r) => r.eventId).sort()).toEqual(["e1", "e2"]);
      expect(await store.deleteEventInvite("e1")).toBe(true);
      expect(await store.getEventInvite("e1")).toBeNull();
    });

    it("marks a person as left and back", async () => {
      await store.upsertEmployee(employee({ email: "a@innovinlabs.com" }));
      expect((await store.getEmployee("a@innovinlabs.com"))?.leftOn).toBeNull();
      expect(await store.setLeftOn("a@innovinlabs.com", "2026-11-18")).toBe(true);
      expect((await store.getEmployee("a@innovinlabs.com"))?.leftOn).toBe("2026-11-18");
      expect(await store.setLeftOn("a@innovinlabs.com", null)).toBe(true);
      expect((await store.listEmployees())[0].leftOn).toBeNull();
      expect(await store.setLeftOn("nobody@innovinlabs.com", "2026-11-18")).toBe(false);
    });

    it("keeps one closed day per date and reports removals", async () => {
      const row = { date: "2026-11-27", reason: "Building maintenance", createdBy: "admin@innovinlabs.com", createdAt: iso() };
      expect(await store.addClosedDay(row)).toBe(true);
      expect(await store.addClosedDay({ ...row, reason: "Again" })).toBe(false);
      await store.addClosedDay({ ...row, date: "2026-12-01", reason: "Offsite" });
      expect(await store.listClosedDays("2026-11-01", "2026-11-30")).toEqual([row]);
      expect(await store.listClosedDays("2026-11-01", "2026-12-31")).toHaveLength(2);
      expect(await store.removeClosedDay("2026-11-27")).toBe(true);
      expect(await store.removeClosedDay("2026-11-27")).toBe(false);
      expect(await store.listClosedDays("2026-11-01", "2026-11-30")).toEqual([]);
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

    describe("feed, tea, snacks and reading", () => {
      const notice = (p: Partial<import("@/lib/types").NoticeRow> = {}) => ({ id: uid(), kind: "quote" as const, title: "", body: "Hello", attribution: "", color: "yellow" as const, anonymous: false, authorEmail: "a@innovinlabs.com", authorName: "Asha", createdAt: iso(), ...p });

      it("stores kudos, polls and photo notes as notices, keeping their extra fields", async () => {
        await store.addNotice(notice({ kind: "kudos", toEmail: "b@innovinlabs.com", toName: "Bala" }));
        await store.addNotice(notice({ kind: "poll", options: ["Biryani", "Pizza"], closesAt: iso(86_400_000), createdAt: iso(1000) }));
        await store.addNotice(notice({ image: "data:image/jpeg;base64,AAAA", createdAt: iso(2000) }));
        const rows = await store.listNotices(10);
        expect(rows.map((r) => r.kind)).toEqual(["quote", "poll", "kudos"]);
        expect(rows[0].image).toBe("data:image/jpeg;base64,AAAA");
        expect(rows[1]).toMatchObject({ options: ["Biryani", "Pizza"], closesAt: iso(86_400_000) });
        expect(rows[2]).toMatchObject({ toEmail: "b@innovinlabs.com", toName: "Bala" });
      });

      it("one poll vote per person: a new vote replaces the old one, null takes it back", async () => {
        const poll = await store.addNotice(notice({ kind: "poll", options: ["A", "B", "C"] }));
        expect(await store.votePoll(poll.id, "a@innovinlabs.com", 0)).toBe(true);
        expect(await store.votePoll(poll.id, "a@innovinlabs.com", 2)).toBe(true);
        expect(await store.votePoll(poll.id, "b@innovinlabs.com", 2)).toBe(true);
        expect(await store.votePoll("missing", "a@innovinlabs.com", 0)).toBe(false);
        let votes = await store.listPollVotes([poll.id]);
        expect(votes.filter((v) => v.option === 2)).toHaveLength(2);
        expect(votes.find((v) => v.email === "a@innovinlabs.com")?.option).toBe(2);
        await store.votePoll(poll.id, "a@innovinlabs.com", null);
        votes = await store.listPollVotes([poll.id]);
        expect(votes.map((v) => v.email)).toEqual(["b@innovinlabs.com"]);
        await store.deleteNotice(poll.id);
        expect(await store.listPollVotes([poll.id])).toEqual([]);
      });

      it("tea: one place per person per day, and leaving the round removes it", async () => {
        await store.setTea("2026-09-23", "a@innovinlabs.com", true);
        await store.setTea("2026-09-23", "a@innovinlabs.com", true);
        await store.setTea("2026-09-23", "b@innovinlabs.com", true);
        await store.setTea("2026-09-24", "a@innovinlabs.com", true);
        expect((await store.listTea("2026-09-23")).map((t) => t.email).sort()).toEqual(["a@innovinlabs.com", "b@innovinlabs.com"]);
        await store.setTea("2026-09-23", "a@innovinlabs.com", false);
        expect((await store.listTea("2026-09-23")).map((t) => t.email)).toEqual(["b@innovinlabs.com"]);
      });

      it("snacks: items move between suggested, shelf and dismissed; votes toggle per voter and can be cleared", async () => {
        const item = await store.addSnack({ id: uid(), name: "Makhana", note: "", status: "suggested", orderedAt: null, createdAt: iso() });
        expect(await store.toggleSnackVote(item.id, "ref-1")).toBe(true);
        expect(await store.toggleSnackVote(item.id, "ref-2")).toBe(true);
        expect(await store.toggleSnackVote(item.id, "ref-1")).toBe(false);
        expect(await store.toggleSnackVote("missing", "ref-1")).toBeNull();
        expect((await store.listSnackVotes()).filter((v) => v.itemId === item.id).map((v) => v.voterRef)).toEqual(["ref-2"]);
        expect(await store.setSnackStatus(item.id, "shelf", null)).toBe(true);
        expect(await store.setSnackStatus(item.id, "shelf", iso(1000))).toBe(true);
        expect((await store.getSnack(item.id))).toMatchObject({ status: "shelf", orderedAt: iso(1000) });
        await store.clearSnackVotes(item.id);
        expect((await store.listSnackVotes()).filter((v) => v.itemId === item.id)).toEqual([]);
        expect(await store.setSnackStatus("missing", "dismissed", null)).toBe(false);
        expect((await store.listSnacks()).map((s) => s.name)).toEqual(["Makhana"]);
      });

      it("reading: one row per person per book, updated in place and removable", async () => {
        const book = await store.addBook({ id: uid(), title: "Deep Work", author: "Cal Newport", createdAt: iso() });
        expect((await store.listBooks()).map((b) => b.title)).toEqual(["Deep Work"]);
        await store.setReading({ email: "a@innovinlabs.com", bookId: book.id, status: "reading", page: 10, pages: 300, updatedAt: iso() });
        await store.setReading({ email: "a@innovinlabs.com", bookId: book.id, status: "done", page: 300, pages: 300, updatedAt: iso(1000) });
        await store.setReading({ email: "b@innovinlabs.com", bookId: book.id, status: "want", page: 0, pages: 0, updatedAt: iso() });
        const rows = await store.listReadings();
        expect(rows).toHaveLength(2);
        expect(rows.find((r) => r.email === "a@innovinlabs.com")).toMatchObject({ status: "done", page: 300, updatedAt: iso(1000) });
        await store.clearReading("b@innovinlabs.com", book.id);
        expect((await store.listReadings()).map((r) => r.email)).toEqual(["a@innovinlabs.com"]);
      });

      it("a birthday is day and month only, hidden unless shown, and survives a re-sign-in", async () => {
        await store.upsertEmployee({ email: "a@innovinlabs.com", name: "Asha", picture: "", role: "member", joinedOn: null, stepsOffset: 0, createdAt: iso(), lastSeenAt: iso() });
        expect(await store.getEmployee("a@innovinlabs.com")).toMatchObject({ birthday: null, showBirthday: false });
        expect(await store.setBirthday("a@innovinlabs.com", "03-14", true)).toBe(true);
        expect(await store.setBirthday("nobody@innovinlabs.com", "03-14", true)).toBe(false);
        await store.upsertEmployee({ email: "a@innovinlabs.com", name: "Asha", picture: "", role: "member", joinedOn: null, stepsOffset: 0, createdAt: iso(), lastSeenAt: iso(60_000) });
        expect(await store.getEmployee("a@innovinlabs.com")).toMatchObject({ birthday: "03-14", showBirthday: true });
      });
    });

    describe("office days", () => {
      it("markDay sets the day's mode once per person per day, and a later mark replaces it", async () => {
        const first = await store.markDay(attendance({ declaredMode: "office", source: "wifi" }));
        expect(first).toMatchObject({ declaredMode: "office", source: "wifi", checkOutAt: null });
        const changed = await store.markDay(attendance({ id: uid(), declaredMode: "remote", source: "self", checkInAt: iso(60_000) }));
        expect(changed.id).toBe(first.id);
        expect(changed).toMatchObject({ declaredMode: "remote", source: "self", checkInAt: iso(60_000) });
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);
      });

      it("markDay reopens a day that was checked out under the old flow", async () => {
        await store.checkIn(attendance({ declaredMode: "office" }));
        await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(3_600_000));
        const marked = await store.markDay(attendance({ id: uid(), declaredMode: "office", source: "location", lat: 12.9, lng: 77.6, accuracyM: 20 }));
        expect(marked).toMatchObject({ checkOutAt: null, declaredMode: "office", source: "location", lat: 12.9, lng: 77.6 });
      });

      it("clearDay removes only that person's day", async () => {
        await store.markDay(attendance({ declaredMode: "office", source: "wifi" }));
        await store.markDay(attendance({ id: uid(), email: "b@innovinlabs.com", declaredMode: "office", source: "wifi" }));
        expect(await store.clearDay("a@innovinlabs.com", "2026-09-23")).toBe(true);
        expect(await store.clearDay("a@innovinlabs.com", "2026-09-23")).toBe(false);
        expect(await store.getAttendance("a@innovinlabs.com", "2026-09-23")).toBeNull();
        expect(await store.getAttendance("b@innovinlabs.com", "2026-09-23")).not.toBeNull();
      });

      it("old rows without a source read as null", async () => {
        const row = await store.checkIn(attendance());
        expect(row.source ?? null).toBeNull();
      });

      it("keeps a log of changed days, newest first, per person", async () => {
        await store.addAttendanceChange({ id: uid(), email: "a@innovinlabs.com", date: "2026-09-21", from: null, to: "office", by: "a@innovinlabs.com", kind: "late", at: iso() });
        await store.addAttendanceChange({ id: uid(), email: "a@innovinlabs.com", date: "2026-09-22", from: "remote", to: null, by: "admin@innovinlabs.com", kind: "admin", at: iso(60_000) });
        await store.addAttendanceChange({ id: uid(), email: "b@innovinlabs.com", date: "2026-09-22", from: null, to: "remote", by: "b@innovinlabs.com", kind: "late", at: iso(120_000) });
        const mine = await store.listAttendanceChanges("a@innovinlabs.com", 10);
        expect(mine.map((c) => c.date)).toEqual(["2026-09-22", "2026-09-21"]);
        expect(mine[0]).toMatchObject({ from: "remote", to: null, by: "admin@innovinlabs.com", kind: "admin", at: iso(60_000) });
        expect(await store.listAttendanceChanges("a@innovinlabs.com", 1)).toHaveLength(1);
      });

      it("a person has regular office days: none by default, and they survive a re-sign-in", async () => {
        const created = await store.upsertEmployee(employee());
        expect(created.officeDays).toEqual([]);
        expect(created.officeExempt).toBe(false);
        expect(await store.setOfficeDays("a@innovinlabs.com", [2, 0])).toBe(true);
        expect(await store.setOfficeDays("nobody@innovinlabs.com", [1])).toBe(false);
        await store.upsertEmployee(employee({ lastSeenAt: iso(60_000) }));
        expect((await store.getEmployee("a@innovinlabs.com"))?.officeDays).toEqual([0, 2]);
        expect((await store.listEmployees())[0].officeDays).toEqual([0, 2]);
      });

      it("an admin can exempt someone from the office-day target, and it survives a re-sign-in", async () => {
        await store.upsertEmployee(employee());
        expect(await store.setOfficeExempt("a@innovinlabs.com", true)).toBe(true);
        expect(await store.setOfficeExempt("nobody@innovinlabs.com", true)).toBe(false);
        await store.upsertEmployee(employee({ lastSeenAt: iso(60_000) }));
        expect((await store.getEmployee("a@innovinlabs.com"))?.officeExempt).toBe(true);
        expect(await store.setOfficeExempt("a@innovinlabs.com", false)).toBe(true);
        expect((await store.listEmployees())[0].officeExempt).toBe(false);
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
