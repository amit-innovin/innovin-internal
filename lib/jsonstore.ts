import { promises as fs } from "fs";
import path from "path";
import type {
  AnnouncementRow,
  AttendanceRow,
  AwayRow,
  EmployeeRow,
  EventRow,
  GrievanceRow,
  LeaveBalanceRow,
  OrderRow,
  RsvpRow,
  Store,
  WifiRow,
} from "./types";

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
  events: EventRow[];
  rsvps: RsvpRow[];
  leaveBalances: LeaveBalanceRow[];
};

const empty = (): DB => ({ attendance: [], orders: [], grievances: [], wifi: [], announcements: [], employees: [], away: [], events: [], rsvps: [], leaveBalances: [] });

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
  const db: DB = { ...empty(), ...JSON.parse(raw) };
  // One-time migration: scrub any device-linked submitter refs ever written, so the
  // file can't be joined against away/orders to de-anonymize old submissions.
  let dirty = false;
  for (const g of db.grievances) {
    if (g.submitterRef !== "anon") {
      g.submitterRef = "anon";
      dirty = true;
    }
  }
  if (dirty) await write(db);
  return db;
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
  listAttendanceRange: (email, fromDate, toDate) =>
    query((db) =>
      db.attendance
        .filter((r) => r.email === email && r.date >= fromDate && r.date <= toDate)
        .sort((a, b) => a.date.localeCompare(b.date) || a.checkInAt.localeCompare(b.checkInAt)),
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
      // Never persist a device-linked ref — "anonymous" must survive a DB leak.
      const safe = { ...row, submitterRef: "anon" };
      db.grievances.unshift(safe);
      return { result: safe, changed: true };
    }),
  setGrievanceStatus: (id, status) =>
    mutate((db) => {
      const row = db.grievances.find((r) => r.id === id);
      if (row) row.status = status;
      return { result: !!row, changed: !!row };
    }),
  listGrievances: () => query((db) => db.grievances.sort(newestFirst)),
  listGrievancesByIds: (ids, limit) =>
    query((db) =>
      db.grievances
        .filter((r) => ids.includes(r.id))
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
  setRole: (email, role) =>
    mutate((db) => {
      const row = db.employees.find((e) => e.email === email);
      if (row) row.role = role;
      return { result: !!row, changed: !!row };
    }),
  setJoinedOn: (email, joinedOn) =>
    mutate((db) => {
      const row = db.employees.find((e) => e.email === email);
      if (row) row.joinedOn = joinedOn;
      return { result: !!row, changed: !!row };
    }),
  setLeaveBalance: (row) =>
    mutate((db) => {
      const existing = db.leaveBalances.find((b) => b.email === row.email && b.year === row.year);
      if (existing) {
        Object.assign(existing, row);
        return { result: existing, changed: true };
      }
      db.leaveBalances.unshift(row);
      return { result: row, changed: true };
    }),
  listLeaveBalances: (year) => query((db) => db.leaveBalances.filter((b) => b.year === year)),
  listEmployees: () =>
    query((db) => db.employees.slice().sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))),

  addAway: (row) =>
    mutate((db) => {
      db.away.unshift(row);
      return { result: row, changed: true };
    }),
  setAwayStatus: (id, status, decidedBy, decidedAt) =>
    mutate((db) => {
      const row = db.away.find((r) => r.id === id);
      if (row) {
        row.status = status;
        row.decidedBy = decidedBy;
        row.decidedAt = decidedAt;
      }
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
  listAwayByEmail: (email, limit) =>
    query((db) =>
      db.away
        .filter((r) => r.email === email)
        .sort(newestFirst)
        .slice(0, limit),
    ),

  addEvent: (row) =>
    mutate((db) => {
      db.events.unshift(row);
      return { result: row, changed: true };
    }),
  getEvent: (rid) => query((db) => db.events.find((e) => e.id === rid) ?? null),
  deleteEvent: (rid) =>
    mutate((db) => {
      const before = db.events.length;
      db.events = db.events.filter((e) => e.id !== rid);
      const found = db.events.length !== before;
      if (found) db.rsvps = db.rsvps.filter((r) => r.eventId !== rid);
      return { result: found, changed: found };
    }),
  listEvents: (fromIso, limit) =>
    query((db) =>
      db.events
        .filter((e) => e.startsAt >= fromIso)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, limit),
    ),
  setRsvp: (eventId, ref, email, going) =>
    mutate((db) => {
      if (going) {
        const existing = db.rsvps.find((r) => r.eventId === eventId && r.submitterRef === ref);
        if (existing) {
          existing.email = email;
        } else {
          db.rsvps.push({ eventId, submitterRef: ref, email, createdAt: new Date().toISOString() });
        }
      } else {
        db.rsvps = db.rsvps.filter((r) => !(r.eventId === eventId && r.submitterRef === ref));
      }
      return { result: undefined, changed: true };
    }),
  listRsvps: (eventId) =>
    query((db) =>
      db.rsvps
        .filter((r) => r.eventId === eventId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    ),
  rsvpCounts: (eventIds) =>
    query((db) => {
      const counts: Record<string, number> = {};
      for (const r of db.rsvps) if (eventIds.includes(r.eventId)) counts[r.eventId] = (counts[r.eventId] ?? 0) + 1;
      return counts;
    }),
  myRsvpEventIds: (ref) => query((db) => db.rsvps.filter((r) => r.submitterRef === ref).map((r) => r.eventId)),
};
