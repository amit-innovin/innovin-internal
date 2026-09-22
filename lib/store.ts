import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// v0 persistence: flat JSON file. Swap for Postgres when we outgrow it.
const FILE = path.join(process.cwd(), "data", "store.json");

export type AttendanceRow = {
  id: string;
  email: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
};

export type OrderRow = {
  id: string;
  date: string;
  itemId: string;
  preference: string;
  instructions: string;
  submitterRef: string;
  createdAt: string;
};

export type GrievanceRow = {
  id: string;
  body: string;
  displayName: string | null;
  submitterRef: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
};

export type WifiRow = {
  id: string;
  quality: "good" | "poor";
  note: string;
  downMbps: number | null;
  upMbps: number | null;
  createdAt: string;
};

type DB = {
  attendance: AttendanceRow[];
  orders: OrderRow[];
  grievances: GrievanceRow[];
  wifi: WifiRow[];
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

export async function add<K extends keyof DB>(key: K, row: DB[K][number]) {
  const db = await read();
  db[key].unshift(row as never);
  await write(db);
  return row;
}

export async function updateAttendance(email: string, date: string, patch: Partial<AttendanceRow>) {
  const db = await read();
  const row = db.attendance.find((r) => r.email === email && r.date === date);
  if (row) Object.assign(row, patch);
  await write(db);
  return row;
}

export async function list<K extends keyof DB>(key: K, date?: string) {
  const db = await read();
  const rows = db[key] as { date?: string }[];
  return (date ? rows.filter((r) => r.date === date) : rows) as DB[K];
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function submitterRef(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export const id = () => crypto.randomUUID();
