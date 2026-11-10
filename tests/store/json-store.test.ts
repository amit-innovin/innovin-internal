import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { jsonStore } from "@/lib/jsonstore";
import { storeContract } from "./contract";

const dir = path.join(os.tmpdir(), `innovin-json-store-${process.pid}`);
const file = path.join(dir, "store.json");
process.env.DATA_FILE = file;

storeContract(
  "JSON",
  async () => jsonStore,
  async () => {
    await fs.rm(dir, { recursive: true, force: true });
  },
);

describe("JSON store safety", () => {
  it("preserves legacy declarations once without resurrecting an explicitly cleared mode", async () => {
    await fs.mkdir(dir, { recursive: true });
    const row = { id: "legacy", email: "a@innovinlabs.com", date: "2026-10-26", checkInAt: "2026-10-26T04:00:00Z", checkOutAt: null, lat: null, lng: null, accuracyM: null };
    await fs.writeFile(file, JSON.stringify({ attendance: [row], workspaceProfiles: [{ email: row.email, mode: "office", presenceDate: row.date }] }));
    expect(await jsonStore.getAttendance(row.email, row.date)).toMatchObject({ declaredMode: "office" });
    await jsonStore.checkIn({ ...row, declaredMode: null });
    expect(await jsonStore.getAttendance(row.email, row.date)).toMatchObject({ declaredMode: null });
  });

  it("still loads an old data file that holds removed planner data", async () => {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, JSON.stringify({ plannerDays: [{ email: "a@innovinlabs.com", date: "2026-10-15", kind: "office" }], announcements: [{ id: "k", title: "Kept", body: "", tag: "Office", createdAt: "2026-10-01T00:00:00Z" }] }));
    expect(await jsonStore.listAnnouncements(10)).toHaveLength(1);
    await jsonStore.addWifi({ id: "w", quality: "good", note: "", downMbps: null, upMbps: null, createdAt: new Date().toISOString() });
    expect(await jsonStore.listWifi(10)).toHaveLength(1);
  });

  it("refuses to read (and never overwrites) a corrupt data file", async () => {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, "{ this is not json");
    await expect(jsonStore.listWifi(10)).rejects.toThrow();
    await expect(jsonStore.addWifi({ id: "x", quality: "good", note: "", downMbps: null, upMbps: null, createdAt: new Date().toISOString() })).rejects.toThrow();
    expect(await fs.readFile(file, "utf8")).toBe("{ this is not json");
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("treats a missing file as an empty store and leaves no temp files behind", async () => {
    await fs.rm(dir, { recursive: true, force: true });
    expect(await jsonStore.listAnnouncements(10)).toEqual([]);
    await jsonStore.addAnnouncement({ id: "a", title: "T", body: "", tag: "Office", createdAt: new Date().toISOString() });
    expect((await fs.readdir(dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});
