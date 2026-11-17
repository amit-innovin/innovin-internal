import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, describe, expect, it, vi } from "vitest";

// markDay against an isolated JSON store file.
const dir = mkdtempSync(path.join(tmpdir(), "markday-"));
vi.stubEnv("DATA_FILE", path.join(dir, "store.json"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("markDay on a closed day", () => {
  it("refuses an office fix for a past day the office was closed", async () => {
    const { markDay } = await import("@/lib/days");
    const { store } = await import("@/lib/store");
    const { todayIST } = await import("@/lib/time");
    const { addDays } = await import("@/lib/office-days");
    const yesterday = addDays(todayIST(), -1);
    await store.addClosedDay({ date: yesterday, reason: "Maintenance", createdBy: "admin", createdAt: new Date().toISOString() });
    const result = await markDay({ email: "a@innovinlabs.com", date: yesterday, mode: "office", lat: null, lng: null, accuracyM: null });
    expect(result).toMatchObject({ ok: false, status: 409, code: "closed" });
    expect(await markDay({ email: "a@innovinlabs.com", date: yesterday, mode: null, lat: null, lng: null, accuracyM: null })).toEqual({ ok: true });
  });
});
