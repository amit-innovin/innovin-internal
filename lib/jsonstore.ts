import { promises as fs } from "fs";
import path from "path";
import type { AnnouncementRow, AttendanceRow, AwayRow, EmployeeRow, GrievanceRow, OrderRow, Store, WifiRow } from "./types";

// Local/dev persistence: a flat JSON file. Used only when DATABASE_URL is unset — never on
// serverless (see store.ts). DATA_FILE lets tests point at an isolated file.
const file = () => process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json");

type DB = {
  attendance: AttendanceRow[];
  orders: OrderRow[];
  grievances: GrievanceRow[];
  wifi: WifiRow[];
  announcements: AnnouncementRow[];
  employees: EmployeeRow[];
  away: AwayRow[];
};

const empty = (): DB => ({ attendance: [], orders: [], grievances: [], wifi: [], announcements: [], employees: [], away: [] });

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

// A missing file is an empty store; a corrupt file is an error and is never silently overwritten.
async function read(): Promise<DB> {
  let raw: string;
  try {
    raw = await fs.readFile(/* turbopackIgnore: true */ file(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw err;
  }
  return { ...empty(), ...JSON.parse(raw) };
}

// Atomic replace: write a temp file, then rename it over the original.
async function write(db: DB) {
  const target = file();
  await fs.mkdir(/* turbopackIgnore: true */ path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(/* turbopackIgnore: true */ tmp, JSON.stringify(db, null, 2));
  await fs.rename(/* turbopackIgnore: true */ tmp, target);
}

// Every operation runs through one queue so concurrent requests can't interleave
// read-modify-write cycles and lose updates.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

// Load, let `fn` mutate, and persist only when it reports a change.
const mutate = <T>(fn: (db: DB) => { result: T; changed: boolean }) =>
  locked(async () => {
    const db = await read();
    const { result, changed } = fn(db);
    if (changed) await write(db);
    return result;
  });

const query = <T>(fn: (db: DB) => T) => locked(async () => fn(await read()));

export const jsonStore: Store = {
  checkIn: (row) =>
    mutate((db) => {
      const open = db.attendance.find((r) => r.email === row.email && r.date === row.date && !r.checkOutAt);
      if (open) return { result: open, changed: false };
      db.attendance.unshift(row);
      return { result: row, changed: true };
    }),
  checkOut: (email, date, at) =>
    mutate((db) => {
      const open = db.attendance.find((r) => r.email === email && r.date === date && !r.checkOutAt);
      if (open) open.checkOutAt = at;
      return { result: open ?? null, changed: !!open };
    }),
  getAttendance: (email, date) =>
    query((db) => db.attendance.find((r) => r.email === email && r.date === date && !r.checkOutAt) ?? null),
  listAttendanceByEmail: (email, date) =>
    query((db) =>
      db.attendance.filter((r) => r.email === email && r.date === date).sort((a, b) => a.checkInAt.localeCompare(b.checkInAt)),
    ),
  listAttendance: (date) =>
    query((db) => db.attendance.filter((r) => r.date === date).sort((a, b) => a.checkInAt.localeCompare(b.checkInAt))),

  setDayOrders: (date, ref, rows) =>
    mutate((db) => {
      db.orders = db.orders.filter((o) => !(o.date === date && o.submitterRef === ref));
      db.orders.unshift(...rows);
      return { result: rows, changed: true };
    }),
  listOrders: (date) =>
    query((db) => db.orders.filter((r) => r.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
  listOrdersByRef: (ref, limit) =>
    query((db) =>
      db.orders
        .filter((r) => r.submitterRef === ref)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit),
    ),
  deleteOrder: (ref, date) =>
    mutate((db) => {
      const before = db.orders.length;
      db.orders = db.orders.filter((r) => !(r.submitterRef === ref && r.date === date));
      const changed = db.orders.length < before;
      return { result: changed, changed };
    }),

  addGrievance: (row) =>
    mutate((db) => {
      db.grievances.unshift(row);
      return { result: row, changed: true };
    }),
  setGrievanceStatus: (id, status) =>
    mutate((db) => {
      const row = db.grievances.find((r) => r.id === id);
      if (row) row.status = status;
      return { result: !!row, changed: !!row };
    }),
  listGrievances: () => query((db) => db.grievances.sort(newestFirst)),
  listGrievancesByRef: (ref, limit) =>
    query((db) =>
      db.grievances
        .filter((r) => r.submitterRef === ref)
        .sort(newestFirst)
        .slice(0, limit),
    ),

  addWifi: (row) =>
    mutate((db) => {
      db.wifi.unshift(row);
      return { result: row, changed: true };
    }),
  listWifi: (limit) => query((db) => db.wifi.sort(newestFirst).slice(0, limit)),

  addAnnouncement: (row) =>
    mutate((db) => {
      db.announcements.unshift(row);
      return { result: row, changed: true };
    }),
  deleteAnnouncement: (id) =>
    mutate((db) => {
      const before = db.announcements.length;
      db.announcements = db.announcements.filter((r) => r.id !== id);
      return { result: undefined, changed: db.announcements.length < before };
    }),
  listAnnouncements: (limit) => query((db) => db.announcements.sort(newestFirst).slice(0, limit)),

  upsertEmployee: (row) =>
    mutate((db) => {
      const existing = db.employees.find((e) => e.email === row.email);
      if (existing) {
        existing.name = row.name;
        existing.picture = row.picture;
        existing.lastSeenAt = row.lastSeenAt;
        return { result: existing, changed: true };
      }
      db.employees.unshift(row);
      return { result: row, changed: true };
    }),
  getEmployee: (email) => query((db) => db.employees.find((e) => e.email === email) ?? null),
  listEmployees: () =>
    query((db) => db.employees.slice().sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))),

  addAway: (row) =>
    mutate((db) => {
      db.away.unshift(row);
      return { result: row, changed: true };
    }),
  setAwayStatus: (id, status) =>
    mutate((db) => {
      const row = db.away.find((r) => r.id === id);
      if (row) row.status = status;
      return { result: !!row, changed: !!row };
    }),
  listAway: (limit) => query((db) => db.away.sort(newestFirst).slice(0, limit)),
  listAwayByRef: (ref, limit) =>
    query((db) =>
      db.away
        .filter((r) => r.submitterRef === ref)
        .sort(newestFirst)
        .slice(0, limit),
    ),
};
