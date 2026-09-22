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
