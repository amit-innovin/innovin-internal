import { assertRequestEditable, fulfillmentOf, nextFulfillment, canMoveFulfillment, sameTray } from "./order-state";
import { promises as fs } from "fs";
import path from "path";
import type {
  NoticeRow,
  NoticeReaction,
  AnnouncementRow,
  AttendanceRow,
  AwayRow,
  EmployeeRow,
  EventRow,
  GrievanceRow,
  LeaveBalanceRow,
  PingRow,
  PushSubscriptionRow,
  OrderRow,
  RsvpRow,
  StepsRow,
  Store,
  WifiRow,
  WorkspaceProfile,
  PlannerDay,
  ProviderRecord,
} from "./types";
import { pingExpired } from "./pings";

// Local/dev persistence: a flat JSON file. Used only when DATABASE_URL is unset — never on
// serverless (see store.ts). DATA_FILE lets tests point at an isolated file.
const file = () => process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json");

type DB = {
  providerRecords: ProviderRecord[];
  notices: NoticeRow[];
  noticeReactions: NoticeReaction[];
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
  pushSubscriptions: PushSubscriptionRow[];
  steps: StepsRow[];
  pings: PingRow[];
  workspaceProfiles: WorkspaceProfile[];
  plannerDays: PlannerDay[];
};

const empty = (): DB => ({ providerRecords: [], notices: [], noticeReactions: [], attendance: [], orders: [], grievances: [], wifi: [], announcements: [], employees: [], away: [], events: [], rsvps: [], leaveBalances: [], pushSubscriptions: [], steps: [], pings: [], workspaceProfiles: [], plannerDays: [] });

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
  // Upgrade old workspace declarations once. Explicit null means intentionally cleared.
  for (const row of db.attendance) {
    if (row.declaredMode !== undefined) continue;
    const profile = db.workspaceProfiles.find(p => p.email === row.email && p.presenceDate === row.date);
    row.declaredMode = profile?.mode === "office" || profile?.mode === "remote" ? profile.mode : null;
    dirty = true;
  }

  for (const g of db.grievances) {
    if (g.submitterRef !== "anon") {
      g.submitterRef = "anon";
      dirty = true;
    }
  }
  // Pings keep no history — drop anything past the TTL on every read.
  const live = db.pings.filter((p) => !pingExpired(p.createdAt));
  if (live.length !== db.pings.length) {
    db.pings = live;
    dirty = true;
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
  getProviderRecord: key => query(db => db.providerRecords.find(r => r.key === key) ?? null),
  putProviderRecord: (key, expectedVersion, value, updatedAt) => mutate(db => {
    const row = db.providerRecords.find(r => r.key === key);
    if ((!row && expectedVersion !== null) || (row && row.version !== expectedVersion)) return { result: false, changed: false };
    if (row) { row.version++; row.value = value; row.updatedAt = updatedAt; }
    else db.providerRecords.push({ key, version: 1, value, updatedAt });
    return { result: true, changed: true };
  }),

  addNotice: (row) => mutate((db) => {
    const safe = row.anonymous ? { ...row, authorEmail: null, authorName: null } : row;
    db.notices.push(safe);
    return { result: safe, changed: true };
  }),
  listNotices: (limit) => query((db) => db.notices.sort(newestFirst).slice(0, limit)),
  deleteNotice: (id) => mutate((db) => {
    const exists = db.notices.some(n => n.id === id);
    db.notices = db.notices.filter(n => n.id !== id);
    db.noticeReactions = db.noticeReactions.filter(n => n.noticeId !== id);
    return { result: exists, changed: exists };
  }),
  toggleNoticeReaction: (id, email, emoji) => mutate((db) => {
    if (!db.notices.some(n => n.id === id)) return { result: false, changed: false };
    const i = db.noticeReactions.findIndex(n => n.noticeId === id && n.email === email && n.emoji === emoji);
    if (i >= 0) db.noticeReactions.splice(i, 1);
    else db.noticeReactions.push({ noticeId: id, email, emoji });
    return { result: true, changed: true };
  }),
  listNoticeReactions: (ids) => query((db) => db.noticeReactions.filter(n => ids.includes(n.noticeId))),
  getWorkspaceProfile: (email) => query((db) => db.workspaceProfiles.find((p) => p.email === email) ?? null),
  listWorkspaceProfiles: () => query((db) => db.workspaceProfiles),
  saveWorkspaceProfile: (email, patch) => mutate((db) => {
    let profile = db.workspaceProfiles.find((p) => p.email === email);
    if (!profile) {
      profile = { email, designation: "", department: "", project: "", floor: "", desk: "", focus: "", mode: null, presenceDate: "" };
      db.workspaceProfiles.push(profile);
    }
    Object.assign(profile, patch, { email });
    return { result: profile, changed: true };
  }),
  setPlannerDay: (row) => mutate((db) => {
    db.plannerDays = db.plannerDays.filter((d) => d.email !== row.email || d.date !== row.date);
    db.plannerDays.push(row);
    return { result: undefined, changed: true };
  }),
  deletePlannerDay: (email, date) => mutate((db) => {
    db.plannerDays = db.plannerDays.filter((d) => d.email !== email || d.date !== date);
    return { result: undefined, changed: true };
  }),
  listPlannerDays: (email, from, to) => query((db) => db.plannerDays.filter((d) => d.email === email && d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date))),
  // One row per person per day: a fresh check-in reopens the day's row (back in = in again),
  // so the row's checkInAt is always the most recent arrival.
  checkIn: (row) =>
    mutate((db) => {
      const existing = db.attendance.find((r) => r.email === row.email && r.date === row.date);
      if (existing) {
        if (!existing.checkOutAt) {
          if (row.declaredMode !== undefined) existing.declaredMode = row.declaredMode;
          return { result: existing, changed: row.declaredMode !== undefined };
        }
        Object.assign(existing, {
          checkInAt: row.checkInAt,
          checkOutAt: null,
          lat: row.lat,
          lng: row.lng,
          accuracyM: row.accuracyM,
          declaredMode: row.declaredMode ?? null,
        });
        return { result: existing, changed: true };
      }
      const normalized = { ...row, declaredMode: row.declaredMode ?? null };
      db.attendance.unshift(normalized);
      return { result: normalized, changed: true };
    }),
  checkOut: (email, date, at) =>
    mutate((db) => {
      const open = db.attendance.find((r) => r.email === email && r.date === date && !r.checkOutAt);
      if (open) open.checkOutAt = at;
      return { result: open ?? null, changed: !!open };
    }),
  getAttendance: (email, date) =>
    query(
      (db) =>
        db.attendance
          .filter((r) => r.email === email && r.date === date)
          .sort((a, b) => Number(!a.checkOutAt) - Number(!b.checkOutAt) || b.checkInAt.localeCompare(a.checkInAt))[0] ?? null,
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
      assertRequestEditable(db.orders.filter(o=>o.date===date&&o.submitterRef===ref));
      db.orders = db.orders.filter((o) => !(o.date === date && o.submitterRef === ref));
      db.orders.unshift(...rows);
      return { result: rows, changed: true };
    }),
  setOrderFulfillment: (date,ref,expectedIds,expected,next,actor,at) => mutate(db=>{
    const rows=db.orders.filter(o=>o.date===date&&o.submitterRef===ref);
    if(!canMoveFulfillment(expected,next) || !sameTray(rows,expectedIds) || rows.some(r=>fulfillmentOf(r)!==expected))return {result:false,changed:false};
    for(const row of rows)Object.assign(row,{fulfillment:next,fulfillmentAt:at,fulfillmentBy:actor});
    return {result:true,changed:true};
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
      assertRequestEditable(db.orders.filter(r=>r.submitterRef===ref&&r.date===date));
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
      if (row) { row.status = status; row.updatedAt = new Date().toISOString(); }
      return { result: !!row, changed: !!row };
    }),
  listGrievances: () =>
    // Urgent floats above everything else, then newest first.
    query((db) => db.grievances.sort((a, b) => Number(b.urgent) - Number(a.urgent) || newestFirst(a, b))),
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
  getAnnouncement: id=>query(db=>db.announcements.find(a=>a.id===id)??null),
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
  getEmployee: (email) =>
    query((db) => {
      const e = db.employees.find((e) => e.email === email);
      return e ? { ...e, stepsOffset: e.stepsOffset ?? 0 } : null;
    }),
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
  setStepsOffset: (email, days) =>
    mutate((db) => {
      const row = db.employees.find((e) => e.email === email);
      if (row) row.stepsOffset = days;
      return { result: !!row, changed: !!row };
    }),
  setSteps: (row) =>
    mutate((db) => {
      const existing = db.steps.find((s) => s.email === row.email && s.date === row.date);
      if (existing) {
        existing.hit = row.hit;
        existing.steps = row.steps;
        return { result: existing, changed: true };
      }
      db.steps.unshift(row);
      return { result: row, changed: true };
    }),
  listSteps: () =>
    query((db) => db.steps.slice().sort((a, b) => b.date.localeCompare(a.date))),
  listStepsByEmail: (email, limit) =>
    query((db) =>
      db.steps
        .filter((s) => s.email === email)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit),
    ),
  addPing: (row) =>
    mutate((db) => {
      db.pings.unshift(row);
      return { result: row, changed: true };
    }),
  listPingsFor: (email, limit) =>
    query((db) =>
      db.pings
        .filter((p) => p.fromEmail === email || p.toEmail === email)
        .sort(newestFirst)
        .slice(0, limit),
    ),
  markPingsRead: (email, fromEmail) =>
    mutate((db) => {
      let changed = false;
      const at = new Date().toISOString();
      for (const p of db.pings) {
        if (p.toEmail === email && p.fromEmail === fromEmail && !p.readAt) {
          p.readAt = at;
          changed = true;
        }
      }
      return { result: undefined, changed };
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
  savePushSubscription: (row) =>
    mutate((db) => {
      const existing = db.pushSubscriptions.find((s) => s.endpoint === row.endpoint);
      if (existing) {
        Object.assign(existing, row);
        return { result: existing, changed: true };
      }
      db.pushSubscriptions.unshift(row);
      return { result: row, changed: true };
    }),
  deletePushSubscription: (endpoint) =>
    mutate((db) => {
      const before = db.pushSubscriptions.length;
      db.pushSubscriptions = db.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
      return { result: db.pushSubscriptions.length < before, changed: db.pushSubscriptions.length < before };
    }),
  revokePushSession: (ref) => mutate(db => { const before = db.pushSubscriptions.length; db.pushSubscriptions = db.pushSubscriptions.filter(s => s.sessionRef !== ref); return { result: undefined, changed: before !== db.pushSubscriptions.length }; }),
  listPushSubscriptions: (email) =>
    query((db) => (email ? db.pushSubscriptions.filter((s) => s.email === email) : db.pushSubscriptions)),
  listEmployees: () =>
    query((db) =>
      db.employees
        .map((e) => ({ ...e, stepsOffset: e.stepsOffset ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email)),
    ),

  addAway: (row) =>
    mutate((db) => {
      db.away.unshift(row);
      return { result: row, changed: true };
    }),
  getAway: (id) => query(db => db.away.find(r => r.id === id) ?? null),
  listPendingAway: () => query(db => db.away.filter(r => r.status === "pending").sort(newestFirst)),
  setAwayStatus: (id, status, decidedBy, decidedAt, expected) =>
    mutate((db) => {
      const row = db.away.find((r) => r.id === id && r.status === expected);
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
  updateEvent: (rid, expected, patch, updatedAt) => mutate(db => {
    const row=db.events.find(e=>e.id===rid);
    if(!row || (row.updatedAt??row.createdAt)!==expected) return {result:null,changed:false};
    Object.assign(row,{title:patch.title,body:patch.body,category:patch.category,startsAt:patch.startsAt,location:patch.location,...(patch.cancelledAt?{cancelledAt:patch.cancelledAt}:{}),updatedAt}); return {result:row,changed:true};
  }),
  deleteEvent: (rid, expected) =>
    mutate((db) => {
      const row=db.events.find(e=>e.id===rid);
      if(expected && (!row || (row.updatedAt??row.createdAt)!==expected))return {result:false,changed:false};
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
      const event=db.events.find(e=>e.id===eventId);
      if(!event||event.cancelledAt)return {result:false,changed:false};
      if (email) db.rsvps = db.rsvps.filter(r => r.eventId !== eventId || r.email !== email || (going && r.submitterRef === ref));
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
      return { result: true, changed: true };
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
      const seen = new Set<string>();
      for (const r of db.rsvps) {
        const identity = `${r.eventId}:${r.email ?? r.submitterRef}`;
        if (eventIds.includes(r.eventId) && !seen.has(identity)) { counts[r.eventId] = (counts[r.eventId] ?? 0) + 1; seen.add(identity); }
      }
      return counts;
    }),
  myRsvpEventIds: (ref, email) => query((db) => db.rsvps.filter((r) => r.submitterRef === ref || (!!email && r.email === email)).map((r) => r.eventId)),
};
