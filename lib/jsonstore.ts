import { promises as fs } from "fs";
import path from "path";
import type { GrievanceStatus, Store } from "./types";

// Local/dev persistence: flat JSON file. Used when DATABASE_URL is unset.
const FILE = path.join(process.cwd(), "data", "store.json");

type DB = {
  attendance: import("./types").AttendanceRow[];
  orders: import("./types").OrderRow[];
  grievances: import("./types").GrievanceRow[];
  wifi: import("./types").WifiRow[];
};

const empty: DB = { attendance: [], orders: [], grievances: [], wifi: [] };

async function read(): Promise<DB> {
  try {
    return { ...empty, ...JSON.parse(await fs.readFile(FILE, "utf8")) };
  } catch {
    return { ...empty };
  }
}

async function write(db: DB) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

export const jsonStore: Store = {
  async checkIn(row) {
    const db = await read();
    const existing = db.attendance.find((r) => r.email === row.email && r.date === row.date);
    if (existing) return existing;
    db.attendance.unshift(row);
    await write(db);
    return row;
  },
  async checkOut(email, date, at) {
    const db = await read();
    const row = db.attendance.find((r) => r.email === email && r.date === date);
    if (row) {
      row.checkOutAt = at;
      await write(db);
    }
    return row ?? null;
  },
  async getAttendance(email, date) {
    const db = await read();
    return db.attendance.find((r) => r.email === email && r.date === date) ?? null;
  },
  async listAttendance(date) {
    return (await read()).attendance.filter((r) => r.date === date);
  },
  async upsertOrder(row) {
    const db = await read();
    const existing = db.orders.find(
      (r) => r.date === row.date && r.submitterRef === row.submitterRef,
    );
    if (existing) {
      Object.assign(existing, { itemId: row.itemId, preference: row.preference, instructions: row.instructions });
      await write(db);
      return existing;
    }
    db.orders.unshift(row);
    await write(db);
    return row;
  },
  async listOrders(date) {
    return (await read()).orders.filter((r) => r.date === date);
  },
  async addGrievance(row) {
    const db = await read();
    db.grievances.unshift(row);
    await write(db);
    return row;
  },
  async setGrievanceStatus(id, status: GrievanceStatus) {
    const db = await read();
    const row = db.grievances.find((r) => r.id === id);
    if (row) {
      row.status = status;
      await write(db);
    }
  },
  async listGrievances() {
    return (await read()).grievances;
  },
  async addWifi(row) {
    const db = await read();
    db.wifi.unshift(row);
    await write(db);
    return row;
  },
  async listWifi(limit) {
    return (await read()).wifi.slice(0, limit);
  },
};
