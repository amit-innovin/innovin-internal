import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Admin routes against an isolated JSON store file, with the caller signed in as an admin.
const dir = mkdtempSync(path.join(tmpdir(), "admin-fixes-"));
vi.stubEnv("DATA_FILE", path.join(dir, "store.json"));
vi.stubEnv("DATABASE_URL", "");
vi.stubEnv("SESSION_SECRET", "test-secret");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const ADMIN = { email: "admin@innovinlabs.com", name: "Admin" };
vi.mock("@/lib/admin", () => ({
  currentActor: async () => ({ ...ADMIN, role: "admin" }),
  isAdmin: async () => true,
}));

let cookie = "";
beforeAll(async () => {
  const { createUserSession, USER_COOKIE } = await import("@/lib/auth");
  cookie = `${USER_COOKIE}=${createUserSession(ADMIN)}`;
});
const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`https://internal.example${url}`, { method, headers: { cookie, "Content-Type": "application/json", "x-forwarded-for": `10.1.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) });

describe("admin day fixes", () => {
  it("refuses to mark someone in the office on a day the office was closed", async () => {
    const { store } = await import("@/lib/store");
    const { todayIST } = await import("@/lib/time");
    const { addDays } = await import("@/lib/office-days");
    const { POST } = await import("@/app/api/admin/days/route");
    const day = addDays(todayIST(), -2);
    await store.upsertEmployee({ email: "p@innovinlabs.com", name: "P", picture: "", role: "member", joinedOn: null, stepsOffset: 0, createdAt: new Date().toISOString(), lastSeenAt: "" });
    await store.addClosedDay({ date: day, reason: "Diwali", createdBy: ADMIN.email, createdAt: new Date().toISOString() });
    const res = await POST(req("/api/admin/days", "POST", { email: "p@innovinlabs.com", date: day, mode: "office" }));
    expect(res.status).toBe(409);
    expect(await store.getAttendance("p@innovinlabs.com", day)).toBeFalsy();
    // Clearing a closed day is still fine.
    expect((await POST(req("/api/admin/days", "POST", { email: "p@innovinlabs.com", date: day, mode: "none" }))).status).toBe(200);
  });
});

describe("snack order Undo", () => {
  it("puts each item back to when it was last ordered and leaves items marked one by one alone", async () => {
    const { store } = await import("@/lib/store");
    const { todayIST } = await import("@/lib/time");
    const { keyedRef } = await import("@/lib/submitter");
    const { PATCH } = await import("@/app/api/snacks/route");
    const earlier = "2026-11-12T06:00:00.000Z";
    const snack = (id: string, orderedAt: string | null) => store.addSnack({ id, name: id, note: "", status: "shelf", orderedAt, createdAt: new Date().toISOString() });
    await snack("chips", earlier);
    await snack("nuts", null);
    await snack("tea", null);
    const today = todayIST();
    await store.setSnackPick(today, keyedRef("snackpick", "x@innovinlabs.com"), "chips");
    await store.setSnackPick(today, keyedRef("snackpick", "y@innovinlabs.com"), "nuts");

    // Tea is marked ordered on its own first.
    expect((await PATCH(req("/api/snacks", "PATCH", { id: "tea", action: "ordered" }))).status).toBe(200);
    const teaAt = (await store.getSnack("tea"))!.orderedAt;
    expect(teaAt).not.toBeNull();

    expect((await PATCH(req("/api/snacks", "PATCH", { action: "order-placed" }))).status).toBe(200);
    expect((await store.getSnack("chips"))!.orderedAt).not.toBe(earlier);

    expect((await PATCH(req("/api/snacks", "PATCH", { action: "order-undo" }))).status).toBe(200);
    expect((await store.getSnack("chips"))!.orderedAt).toBe(earlier);
    expect((await store.getSnack("nuts"))!.orderedAt).toBeNull();
    expect((await store.getSnack("tea"))!.orderedAt).toBe(teaAt);
  });
});
