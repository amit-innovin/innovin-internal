import { beforeEach, describe, expect, it } from "vitest";
import type { AttendanceRow, GrievanceRow, OrderRow, Store, WifiRow } from "@/lib/types";

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

    describe("attendance", () => {
      it("checks in once per email per day and returns the existing row on repeat", async () => {
        const first = await store.checkIn(attendance());
        const again = await store.checkIn(attendance({ checkInAt: iso(60_000) }));
        expect(again.id).toBe(first.id);
        expect(again.checkInAt).toBe(first.checkInAt);
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);
      });

      it("gets, checks out, and returns null when there is nothing to check out", async () => {
        const row = await store.checkIn(attendance());
        expect((await store.getAttendance("a@innovinlabs.com", "2026-09-23"))?.id).toBe(row.id);
        expect(await store.getAttendance("b@innovinlabs.com", "2026-09-23")).toBeNull();
        const out = await store.checkOut("a@innovinlabs.com", "2026-09-23", iso(3_600_000));
        expect(out?.checkOutAt).toBe(iso(3_600_000));
        expect(await store.checkOut("nobody@innovinlabs.com", "2026-09-23", iso())).toBeNull();
      });

      it("lists one day ordered by check-in time", async () => {
        await store.checkIn(attendance({ email: "late@innovinlabs.com", checkInAt: iso(120_000) }));
        await store.checkIn(attendance({ email: "early@innovinlabs.com", checkInAt: iso(0) }));
        await store.checkIn(attendance({ email: "other-day@innovinlabs.com", date: "2026-09-22" }));
        const rows = await store.listAttendance("2026-09-23");
        expect(rows.map((r) => r.email)).toEqual(["early@innovinlabs.com", "late@innovinlabs.com"]);
      });
    });

    describe("orders", () => {
      it("upserts one order per device per day, keeping the original id", async () => {
        const created = await store.upsertOrder(order());
        const updated = await store.upsertOrder(order({ itemId: "healthy", preference: "healthy", instructions: "no sugar" }));
        expect(updated.id).toBe(created.id);
        expect(updated).toMatchObject({ itemId: "healthy", preference: "healthy", instructions: "no sugar" });
        expect(await store.listOrders("2026-09-23")).toHaveLength(1);
      });

      it("keeps different devices and days separate", async () => {
        await store.upsertOrder(order({ submitterRef: "ref-1" }));
        await store.upsertOrder(order({ submitterRef: "ref-2", createdAt: iso(1000) }));
        await store.upsertOrder(order({ submitterRef: "ref-1", date: "2026-09-22" }));
        expect((await store.listOrders("2026-09-23")).map((o) => o.submitterRef)).toEqual(["ref-1", "ref-2"]);
      });

      it("lists a device's history newest day first with a limit", async () => {
        for (const date of ["2026-09-20", "2026-09-22", "2026-09-21"]) await store.upsertOrder(order({ date }));
        await store.upsertOrder(order({ submitterRef: "someone-else" }));
        const history = await store.listOrdersByRef("ref-1", 2);
        expect(history.map((o) => o.date)).toEqual(["2026-09-22", "2026-09-21"]);
      });

      it("deletes only that device's order for that day", async () => {
        await store.upsertOrder(order());
        await store.upsertOrder(order({ date: "2026-09-22" }));
        await store.upsertOrder(order({ submitterRef: "ref-2" }));
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

      it("updates status and reports unknown ids", async () => {
        const g = await store.addGrievance(grievance());
        expect(await store.setGrievanceStatus(g.id, "resolved")).toBe(true);
        expect((await store.listGrievances())[0].status).toBe("resolved");
        expect(await store.setGrievanceStatus("missing", "resolved")).toBe(false);
      });

      it("lists only the device's own grievances, newest first, with a limit", async () => {
        await store.addGrievance(grievance({ body: "mine-1", createdAt: iso(0) }));
        await store.addGrievance(grievance({ body: "theirs", submitterRef: "ref-2", createdAt: iso(1000) }));
        await store.addGrievance(grievance({ body: "mine-2", createdAt: iso(2000) }));
        await store.addGrievance(grievance({ body: "mine-3", createdAt: iso(3000) }));
        expect((await store.listGrievancesByRef("ref-1", 2)).map((g) => g.body)).toEqual(["mine-3", "mine-2"]);
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

    describe("concurrency", () => {
      it("never loses writes under parallel requests", async () => {
        await Promise.all(Array.from({ length: 25 }, (_, i) => store.addGrievance(grievance({ body: `g${i}` }))));
        expect(await store.listGrievances()).toHaveLength(25);
      });

      it("keeps a single order when one device submits in parallel", async () => {
        await Promise.all(["tea", "snacks", "healthy", "tea"].map((itemId) => store.upsertOrder(order({ itemId }))));
        expect(await store.listOrders("2026-09-23")).toHaveLength(1);
      });

      it("checks in once even when the same email checks in in parallel", async () => {
        await Promise.all(Array.from({ length: 5 }, () => store.checkIn(attendance())));
        expect(await store.listAttendance("2026-09-23")).toHaveLength(1);
      });
    });
  });
}
