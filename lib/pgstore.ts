import { Pool } from "pg";
import { pgConfig } from "./pgconfig";
import type {
  AnnouncementRow,
  AttendanceRow,
  AwayRow,
  AwayStatus,
  EmployeeRow,
  EventRow,
  GrievanceRow,
  GrievanceStatus,
  OrderRow,
  Role,
  Store,
  WifiRow,
} from "./types";

// Postgres persistence — used when DATABASE_URL is set (Neon, Supabase, Vercel Postgres).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS attendance (
  id text PRIMARY KEY,
  email text NOT NULL,
  date text NOT NULL,
  check_in_at timestamptz NOT NULL,
  check_out_at timestamptz,
  lat double precision,
  lng double precision,
  accuracy_m real
);
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  date text NOT NULL,
  item_id text NOT NULL,
  preference text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  submitter_ref text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (date, submitter_ref, item_id)
);
CREATE TABLE IF NOT EXISTS grievances (
  id text PRIMARY KEY,
  body text NOT NULL,
  display_name text,
  image text,
  submitter_ref text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS wifi (
  id text PRIMARY KEY,
  quality text NOT NULL,
  note text NOT NULL DEFAULT '',
  down_mbps real,
  up_mbps real,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  tag text NOT NULL DEFAULT 'Office',
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS employees (
  email text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  picture text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS away (
  id text PRIMARY KEY,
  email text NOT NULL,
  type text NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  submitter_ref text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL,
  starts_at timestamptz NOT NULL,
  location text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submitter_ref text NOT NULL,
  email text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (event_id, submitter_ref)
);
-- Migrations for databases created before sessions/multi-item orders/images existed:
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_email_date_key;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_date_submitter_ref_key;
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS image text;
-- Scrub device-linked refs written before hard anonymity: the DB must not be joinable
-- against away/orders to de-anonymize a submission.
UPDATE grievances SET submitter_ref = 'anon' WHERE submitter_ref <> 'anon';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS joined_on text;
ALTER TABLE away ADD COLUMN IF NOT EXISTS decided_by text;
ALTER TABLE away ADD COLUMN IF NOT EXISTS decided_at timestamptz;
-- Leave types arrived with the policy engine; rows written before it have no bucket and are
-- left NULL rather than guessed at, so they simply don't count against a balance.
ALTER TABLE away ADD COLUMN IF NOT EXISTS leave_type text;
ALTER TABLE away ADD COLUMN IF NOT EXISTS half_day boolean NOT NULL DEFAULT false;
ALTER TABLE away ADD COLUMN IF NOT EXISTS days real NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS accuracy_m real;
-- At most one open (not-checked-out) session per person per day.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_open_session ON attendance (email, date) WHERE check_out_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_day_ref_item ON orders (date, submitter_ref, item_id);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (date);
CREATE INDEX IF NOT EXISTS orders_date_idx ON orders (date);
CREATE INDEX IF NOT EXISTS orders_submitter_idx ON orders (submitter_ref, date DESC);
CREATE INDEX IF NOT EXISTS grievances_created_idx ON grievances (created_at DESC);
CREATE INDEX IF NOT EXISTS grievances_submitter_idx ON grievances (submitter_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS wifi_created_idx ON wifi (created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS away_created_idx ON away (created_at DESC);
CREATE INDEX IF NOT EXISTS away_submitter_idx ON away (submitter_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS events_starts_idx ON events (starts_at);
CREATE INDEX IF NOT EXISTS event_rsvps_ref_idx ON event_rsvps (submitter_ref);`;

// Arbitrary constant key for the schema-init advisory lock.
const SCHEMA_LOCK = 727_071_704;

/* eslint-disable @typescript-eslint/no-explicit-any */
const attendance = (r: any): AttendanceRow => ({
  id: r.id,
  email: r.email,
  date: r.date,
  checkInAt: r.check_in_at?.toISOString?.() ?? r.check_in_at,
  checkOutAt: r.check_out_at ? r.check_out_at.toISOString?.() ?? r.check_out_at : null,
  lat: r.lat ?? null,
  lng: r.lng ?? null,
  accuracyM: r.accuracy_m ?? null,
});
const order = (r: any): OrderRow => ({
  id: r.id,
  date: r.date,
  itemId: r.item_id,
  preference: r.preference,
  instructions: r.instructions,
  submitterRef: r.submitter_ref,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const grievance = (r: any): GrievanceRow => ({
  id: r.id,
  body: r.body,
  displayName: r.display_name,
  image: r.image ?? null,
  submitterRef: r.submitter_ref,
  status: r.status,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const wifi = (r: any): WifiRow => ({
  id: r.id,
  quality: r.quality,
  note: r.note,
  downMbps: r.down_mbps,
  upMbps: r.up_mbps,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const announcement = (r: any): AnnouncementRow => ({
  id: r.id,
  title: r.title,
  body: r.body,
  tag: r.tag,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const employee = (r: any): EmployeeRow => ({
  email: r.email,
  name: r.name,
  picture: r.picture,
  role: r.role ?? "member",
  joinedOn: r.joined_on ?? null,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
  lastSeenAt: r.last_seen_at?.toISOString?.() ?? r.last_seen_at,
});
const away = (r: any): AwayRow => ({
  id: r.id,
  email: r.email,
  type: r.type,
  leaveType: r.leave_type ?? null,
  halfDay: r.half_day ?? false,
  days: Number(r.days ?? 0),
  startDate: r.start_date,
  endDate: r.end_date,
  reason: r.reason,
  status: r.status,
  submitterRef: r.submitter_ref,
  decidedBy: r.decided_by ?? null,
  decidedAt: r.decided_at?.toISOString?.() ?? r.decided_at ?? null,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const event = (r: any): EventRow => ({
  id: r.id,
  title: r.title,
  body: r.body,
  category: r.category,
  startsAt: r.starts_at?.toISOString?.() ?? r.starts_at,
  location: r.location,
  createdBy: r.created_by,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});

class PgStore implements Store {
  private pool: Pool | null = null;
  private ready: Promise<void> | null = null;

  private db() {
    if (!this.pool) {
      this.pool = new Pool(pgConfig());
      // An idle client dropping (e.g. pooler restart) must not crash the process.
      this.pool.on("error", (err) => console.error("[pg] idle client error:", err.message));
    }
    return this.pool;
  }

  // Creates tables once per instance. A transaction-scoped advisory lock stops concurrent cold
  // starts racing on CREATE TABLE (and works through transaction-mode poolers). A failed init is
  // not cached, so the next query retries instead of failing forever.
  private init() {
    this.ready ??= (async () => {
      const client = await this.db().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK]);
        await client.query(SCHEMA);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  private async q(text: string, params: unknown[] = []) {
    await this.init();
    return this.db().query(text, params);
  }

  async checkIn(row: AttendanceRow) {
    const res = await this.q(
      `INSERT INTO attendance (id, email, date, check_in_at, lat, lng, accuracy_m)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email, date) WHERE check_out_at IS NULL DO NOTHING RETURNING *`,
      [row.id, row.email, row.date, row.checkInAt, row.lat, row.lng, row.accuracyM],
    );
    if (res.rows[0]) return attendance(res.rows[0]);
    return (await this.getAttendance(row.email, row.date))!;
  }
  async checkOut(email: string, date: string, at: string) {
    const res = await this.q(
      `UPDATE attendance SET check_out_at = $3 WHERE email = $1 AND date = $2 AND check_out_at IS NULL RETURNING *`,
      [email, date, at],
    );
    return res.rows[0] ? attendance(res.rows[0]) : null;
  }
  async getAttendance(email: string, date: string) {
    const res = await this.q(
      `SELECT * FROM attendance WHERE email = $1 AND date = $2 AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1`,
      [email, date],
    );
    return res.rows[0] ? attendance(res.rows[0]) : null;
  }
  async listAttendanceByEmail(email: string, date: string) {
    const res = await this.q(`SELECT * FROM attendance WHERE email = $1 AND date = $2 ORDER BY check_in_at`, [email, date]);
    return res.rows.map(attendance);
  }
  async listAttendance(date: string) {
    const res = await this.q(`SELECT * FROM attendance WHERE date = $1 ORDER BY check_in_at`, [date]);
    return res.rows.map(attendance);
  }
  async setDayOrders(date: string, ref: string, rows: OrderRow[]) {
    await this.init();
    const client = await this.db().connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM orders WHERE date = $1 AND submitter_ref = $2`, [date, ref]);
      for (const row of rows) {
        await client.query(
          `INSERT INTO orders (id, date, item_id, preference, instructions, submitter_ref, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (date, submitter_ref, item_id) DO UPDATE SET preference = $4, instructions = $5`,
          [row.id, row.date, row.itemId, row.preference, row.instructions, row.submitterRef, row.createdAt],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    return rows;
  }
  async listOrders(date: string) {
    const res = await this.q(`SELECT * FROM orders WHERE date = $1 ORDER BY created_at`, [date]);
    return res.rows.map(order);
  }
  async deleteOrder(ref: string, date: string) {
    const res = await this.q(`DELETE FROM orders WHERE submitter_ref = $1 AND date = $2`, [ref, date]);
    return (res.rowCount ?? 0) > 0;
  }
  async listOrdersByRef(ref: string, limit: number) {
    const res = await this.q(`SELECT * FROM orders WHERE submitter_ref = $1 ORDER BY date DESC LIMIT $2`, [ref, limit]);
    return res.rows.map(order);
  }
  async addGrievance(row: GrievanceRow) {
    const res = await this.q(
      `INSERT INTO grievances (id, body, display_name, image, submitter_ref, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      // Never persist a device-linked ref — "anonymous" must survive a DB leak.
      [row.id, row.body, row.displayName, row.image, "anon", row.status, row.createdAt],
    );
    return grievance(res.rows[0]);
  }
  async setGrievanceStatus(id: string, status: GrievanceStatus) {
    const res = await this.q(`UPDATE grievances SET status = $2 WHERE id = $1`, [id, status]);
    return (res.rowCount ?? 0) > 0;
  }
  async listGrievances() {
    const res = await this.q(`SELECT * FROM grievances ORDER BY created_at DESC`);
    return res.rows.map(grievance);
  }
  async listGrievancesByIds(ids: string[], limit: number) {
    if (ids.length === 0) return [];
    const res = await this.q(
      `SELECT * FROM grievances WHERE id = ANY($1) ORDER BY created_at DESC LIMIT $2`,
      [ids, limit],
    );
    return res.rows.map(grievance);
  }
  async addWifi(row: WifiRow) {
    const res = await this.q(
      `INSERT INTO wifi (id, quality, note, down_mbps, up_mbps, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [row.id, row.quality, row.note, row.downMbps, row.upMbps, row.createdAt],
    );
    return wifi(res.rows[0]);
  }
  async listWifi(limit: number) {
    const res = await this.q(`SELECT * FROM wifi ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows.map(wifi);
  }
  async addAnnouncement(row: AnnouncementRow) {
    const res = await this.q(
      `INSERT INTO announcements (id, title, body, tag, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [row.id, row.title, row.body, row.tag, row.createdAt],
    );
    return announcement(res.rows[0]);
  }
  async deleteAnnouncement(id: string) {
    await this.q(`DELETE FROM announcements WHERE id = $1`, [id]);
  }
  async listAnnouncements(limit: number) {
    const res = await this.q(`SELECT * FROM announcements ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows.map(announcement);
  }
  async upsertEmployee(row: EmployeeRow) {
    const res = await this.q(
      // role is set only on insert — a re-sign-in must never reset someone's granted role.
      // role and joined_on are set only on insert — a re-sign-in must never reset either.
      `INSERT INTO employees (email, name, picture, role, joined_on, created_at, last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET name = $2, picture = $3, last_seen_at = $7 RETURNING *`,
      [row.email, row.name, row.picture, row.role, row.joinedOn, row.createdAt, row.lastSeenAt],
    );
    return employee(res.rows[0]);
  }
  async setRole(email: string, role: Role) {
    const res = await this.q(`UPDATE employees SET role = $2 WHERE email = $1`, [email, role]);
    return (res.rowCount ?? 0) > 0;
  }
  async setJoinedOn(email: string, joinedOn: string | null) {
    const res = await this.q(`UPDATE employees SET joined_on = $2 WHERE email = $1`, [email, joinedOn]);
    return (res.rowCount ?? 0) > 0;
  }
  async getEmployee(email: string) {
    const res = await this.q(`SELECT * FROM employees WHERE email = $1`, [email]);
    return res.rows[0] ? employee(res.rows[0]) : null;
  }
  async listEmployees() {
    const res = await this.q(`SELECT * FROM employees ORDER BY name, email`);
    return res.rows.map(employee);
  }
  async addAway(row: AwayRow) {
    const res = await this.q(
      `INSERT INTO away (id, email, type, leave_type, half_day, days, start_date, end_date, reason, status, submitter_ref, decided_by, decided_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      // prettier-ignore
      [row.id, row.email, row.type, row.leaveType, row.halfDay, row.days, row.startDate, row.endDate, row.reason, row.status, row.submitterRef, row.decidedBy, row.decidedAt, row.createdAt],
    );
    return away(res.rows[0]);
  }
  async setAwayStatus(id: string, status: AwayStatus, decidedBy: string | null, decidedAt: string) {
    const res = await this.q(`UPDATE away SET status = $2, decided_by = $3, decided_at = $4 WHERE id = $1`, [
      id,
      status,
      decidedBy,
      decidedAt,
    ]);
    return (res.rowCount ?? 0) > 0;
  }
  async listAway(limit: number) {
    const res = await this.q(`SELECT * FROM away ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows.map(away);
  }
  async listAwayByRef(ref: string, limit: number) {
    const res = await this.q(`SELECT * FROM away WHERE submitter_ref = $1 ORDER BY created_at DESC LIMIT $2`, [ref, limit]);
    return res.rows.map(away);
  }
  async listAwayByEmail(email: string, limit: number) {
    const res = await this.q(`SELECT * FROM away WHERE email = $1 ORDER BY created_at DESC LIMIT $2`, [email, limit]);
    return res.rows.map(away);
  }
  async addEvent(row: EventRow) {
    const res = await this.q(
      `INSERT INTO events (id, title, body, category, starts_at, location, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [row.id, row.title, row.body, row.category, row.startsAt, row.location, row.createdBy, row.createdAt],
    );
    return event(res.rows[0]);
  }
  async getEvent(rid: string) {
    const res = await this.q(`SELECT * FROM events WHERE id = $1`, [rid]);
    return res.rows[0] ? event(res.rows[0]) : null;
  }
  async deleteEvent(rid: string) {
    const res = await this.q(`DELETE FROM events WHERE id = $1`, [rid]);
    return (res.rowCount ?? 0) > 0;
  }
  async listEvents(fromIso: string, limit: number) {
    const res = await this.q(`SELECT * FROM events WHERE starts_at >= $1 ORDER BY starts_at ASC LIMIT $2`, [fromIso, limit]);
    return res.rows.map(event);
  }
  async setRsvp(eventId: string, ref: string, email: string | null, going: boolean) {
    if (going) {
      await this.q(
        `INSERT INTO event_rsvps (event_id, submitter_ref, email, created_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (event_id, submitter_ref) DO UPDATE SET email = EXCLUDED.email`,
        [eventId, ref, email, new Date().toISOString()],
      );
    } else {
      await this.q(`DELETE FROM event_rsvps WHERE event_id = $1 AND submitter_ref = $2`, [eventId, ref]);
    }
  }
  async listRsvps(eventId: string) {
    const res = await this.q(`SELECT * FROM event_rsvps WHERE event_id = $1 ORDER BY created_at`, [eventId]);
    return res.rows.map((r: any) => ({
      eventId: r.event_id,
      submitterRef: r.submitter_ref,
      email: r.email,
      createdAt: r.created_at?.toISOString?.() ?? r.created_at,
    }));
  }
  async rsvpCounts(eventIds: string[]) {
    if (eventIds.length === 0) return {};
    const res = await this.q(
      `SELECT event_id, COUNT(*)::int AS n FROM event_rsvps WHERE event_id = ANY($1) GROUP BY event_id`,
      [eventIds],
    );
    return Object.fromEntries(res.rows.map((r: any) => [r.event_id, r.n]));
  }
  async myRsvpEventIds(ref: string) {
    const res = await this.q(`SELECT event_id FROM event_rsvps WHERE submitter_ref = $1`, [ref]);
    return res.rows.map((r: any) => r.event_id);
  }
}

export const pgStore = new PgStore();
