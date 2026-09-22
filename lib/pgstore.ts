import { Pool } from "pg";
import type {
  AttendanceRow,
  GrievanceRow,
  GrievanceStatus,
  OrderRow,
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
  UNIQUE (email, date)
);
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  date text NOT NULL,
  item_id text NOT NULL,
  preference text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  submitter_ref text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (date, submitter_ref)
);
CREATE TABLE IF NOT EXISTS grievances (
  id text PRIMARY KEY,
  body text NOT NULL,
  display_name text,
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
);`;

/* eslint-disable @typescript-eslint/no-explicit-any */
const attendance = (r: any): AttendanceRow => ({
  id: r.id,
  email: r.email,
  date: r.date,
  checkInAt: r.check_in_at?.toISOString?.() ?? r.check_in_at,
  checkOutAt: r.check_out_at ? r.check_out_at.toISOString?.() ?? r.check_out_at : null,
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

class PgStore implements Store {
  private pool: Pool | null = null;
  private ready: Promise<unknown> | null = null;

  private db() {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
      this.ready = this.pool.query(SCHEMA);
    }
    return this.pool;
  }

  private async q(text: string, params: unknown[] = []) {
    await this.ready;
    return this.db().query(text, params);
  }

  async checkIn(row: AttendanceRow) {
    const res = await this.q(
      `INSERT INTO attendance (id, email, date, check_in_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (email, date) DO NOTHING RETURNING *`,
      [row.id, row.email, row.date, row.checkInAt],
    );
    if (res.rows[0]) return attendance(res.rows[0]);
    return (await this.getAttendance(row.email, row.date))!;
  }
  async checkOut(email: string, date: string, at: string) {
    const res = await this.q(
      `UPDATE attendance SET check_out_at = $3 WHERE email = $1 AND date = $2 RETURNING *`,
      [email, date, at],
    );
    return res.rows[0] ? attendance(res.rows[0]) : null;
  }
  async getAttendance(email: string, date: string) {
    const res = await this.q(`SELECT * FROM attendance WHERE email = $1 AND date = $2`, [email, date]);
    return res.rows[0] ? attendance(res.rows[0]) : null;
  }
  async listAttendance(date: string) {
    const res = await this.q(`SELECT * FROM attendance WHERE date = $1 ORDER BY check_in_at`, [date]);
    return res.rows.map(attendance);
  }
  async upsertOrder(row: OrderRow) {
    const res = await this.q(
      `INSERT INTO orders (id, date, item_id, preference, instructions, submitter_ref, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (date, submitter_ref)
       DO UPDATE SET item_id = $3, preference = $4, instructions = $5
       RETURNING *`,
      [row.id, row.date, row.itemId, row.preference, row.instructions, row.submitterRef, row.createdAt],
    );
    return order(res.rows[0]);
  }
  async listOrders(date: string) {
    const res = await this.q(`SELECT * FROM orders WHERE date = $1 ORDER BY created_at`, [date]);
    return res.rows.map(order);
  }
  async addGrievance(row: GrievanceRow) {
    const res = await this.q(
      `INSERT INTO grievances (id, body, display_name, submitter_ref, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [row.id, row.body, row.displayName, row.submitterRef, row.status, row.createdAt],
    );
    return grievance(res.rows[0]);
  }
  async setGrievanceStatus(id: string, status: GrievanceStatus) {
    await this.q(`UPDATE grievances SET status = $2 WHERE id = $1`, [id, status]);
  }
  async listGrievances() {
    const res = await this.q(`SELECT * FROM grievances ORDER BY created_at DESC`);
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
}

export const pgStore = new PgStore();
