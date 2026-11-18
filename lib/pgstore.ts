import { Pool } from "pg";
import { pgConfig } from "./pgconfig";
import type {
  NoticeRow,
  NoticeReaction,
  AnnouncementRow,
  AttendanceRow,
  AwayRow,
  AwayStatus,
  EmployeeRow,
  EventRow,
  GrievanceRow,
  GrievanceStatus,
  LeaveBalanceRow,
  PushSubscriptionRow,
  StepsRow,
  Role,
  Store,
  WifiRow,
  WorkspaceProfile,
  AttendanceChangeRow,
  ClosedDayRow,
  TeaRound,
  PlanOverrideRow,
  SnackItem,
  BookRow,
  ReadingRow,
} from "./types";

// Postgres persistence — used when DATABASE_URL is set (Neon, Supabase, Vercel Postgres).
export const SCHEMA = `

CREATE TABLE IF NOT EXISTS notices (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS notice_reactions (
  notice_id text NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  email text NOT NULL,
  emoji text NOT NULL,
  PRIMARY KEY (notice_id, email, emoji)
);
CREATE TABLE IF NOT EXISTS workspace_profiles (
  email text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
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
CREATE TABLE IF NOT EXISTS grievances (
  id text PRIMARY KEY,
  body text NOT NULL,
  display_name text,
  image text,
  urgent boolean NOT NULL DEFAULT false,
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
-- Migrations for databases created before sessions/images existed:
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_email_date_key;
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;
-- Scrub device-linked refs written before hard anonymity: the DB must not be joinable
-- against away to de-anonymize a submission.
UPDATE grievances SET submitter_ref = 'anon' WHERE submitter_ref <> 'anon';
-- Leave balances copied from Zoho People (the system of record) by an admin. One row per
-- person per leave year; as_of is what makes app-side requests countable on top.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint text PRIMARY KEY,
  p256dh text NOT NULL,
  auth text NOT NULL,
  email text,
  created_at timestamptz NOT NULL
);
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS session_ref text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS push_email_idx ON push_subscriptions (email);
-- 10K steps challenge: one row per person per day, today is the only writable day.
CREATE TABLE IF NOT EXISTS steps (
  id text PRIMARY KEY,
  email text NOT NULL,
  date text NOT NULL,
  hit boolean NOT NULL DEFAULT false,
  steps int,
  created_at timestamptz NOT NULL,
  UNIQUE (email, date)
);
-- Days banked in the old spreadsheet before the app took over.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS steps_offset int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS leave_balances (
  email text NOT NULL,
  year int NOT NULL,
  cl real,
  sl real,
  el real,
  fl real,
  as_of timestamptz NOT NULL,
  updated_by text,
  PRIMARY KEY (email, year)
);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
UPDATE employees SET role = 'admin' WHERE role = 'owner';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS joined_on text;
ALTER TABLE away ADD COLUMN IF NOT EXISTS decided_by text;
ALTER TABLE away ADD COLUMN IF NOT EXISTS decided_at timestamptz;
-- Leave types arrived with the policy engine; rows written before it have no bucket and are
-- left NULL rather than guessed at, so they simply don't count against a balance.
ALTER TABLE away ADD COLUMN IF NOT EXISTS leave_type text;
ALTER TABLE away ADD COLUMN IF NOT EXISTS half_day boolean NOT NULL DEFAULT false;
ALTER TABLE away ADD COLUMN IF NOT EXISTS days real NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='attendance' AND column_name='declared_mode') THEN
    ALTER TABLE attendance ADD COLUMN declared_mode text;
    UPDATE attendance a SET declared_mode=p.data->>'mode' FROM workspace_profiles p
      WHERE a.email=p.email AND a.date=p.data->>'presenceDate' AND p.data->>'mode' IN ('office','remote');
  END IF;
END $$;
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS reconciled_request_ids jsonb;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS accuracy_m real;
-- Attendance is one row per person per day — a status, not session history. Fold any
-- multi-session rows written before this into the earliest row (latest check-out kept).
-- The old one-open-session-per-day index must go first: folding sets check_out_at on every
-- row of a group, which momentarily creates multiple "open" rows for that day.
DROP INDEX IF EXISTS attendance_open_session;
UPDATE attendance a SET check_out_at = s.final_out
  FROM (SELECT email, date,
          CASE WHEN COUNT(*) FILTER (WHERE check_out_at IS NULL) > 0 THEN NULL
               ELSE MAX(check_out_at) END AS final_out
        FROM attendance GROUP BY email, date) s
  WHERE a.email = s.email AND a.date = s.date;
-- Ties on identical check_in_at (double-tap retries) fall back to ctid so exactly one survives.
DELETE FROM attendance a USING attendance b
  WHERE a.email = b.email AND a.date = b.date
    AND (a.check_in_at > b.check_in_at OR (a.check_in_at = b.check_in_at AND a.ctid > b.ctid));
ALTER TABLE attendance ADD CONSTRAINT attendance_email_date_key UNIQUE (email, date);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (date);
CREATE INDEX IF NOT EXISTS grievances_created_idx ON grievances (created_at DESC);
CREATE INDEX IF NOT EXISTS grievances_submitter_idx ON grievances (submitter_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS wifi_created_idx ON wifi (created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS away_created_idx ON away (created_at DESC);
CREATE INDEX IF NOT EXISTS away_submitter_idx ON away (submitter_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS steps_date_idx ON steps (date);
-- One-tap attendance: how the day was marked, each person's regular office days, and a log
-- of days changed after the fact.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS office_days jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS office_exempt boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS attendance_changes (
  id text PRIMARY KEY,
  email text NOT NULL,
  date text NOT NULL,
  from_mode text,
  to_mode text,
  changed_by text NOT NULL,
  kind text NOT NULL,
  at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS attendance_changes_email_idx ON attendance_changes (email, at DESC);
-- Days: one date added to or removed from someone's usual office days, and admin-set closures.
CREATE TABLE IF NOT EXISTS plan_overrides (
  email text NOT NULL,
  date text NOT NULL,
  planned boolean NOT NULL,
  PRIMARY KEY (email, date)
);
CREATE INDEX IF NOT EXISTS plan_overrides_date_idx ON plan_overrides (date);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS feed_seen_at timestamptz;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS steps_league boolean NOT NULL DEFAULT false;
ALTER TABLE wifi ADD COLUMN IF NOT EXISTS area text;
CREATE TABLE IF NOT EXISTS nudges (
  date text NOT NULL,
  from_email text NOT NULL,
  to_email text NOT NULL,
  PRIMARY KEY (date, from_email, to_email)
);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS important boolean NOT NULL DEFAULT false;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS pinned_until text;
CREATE TABLE IF NOT EXISTS announcement_acks (
  announcement_id text NOT NULL,
  email text NOT NULL,
  at timestamptz NOT NULL,
  PRIMARY KEY (announcement_id, email)
);
CREATE TABLE IF NOT EXISTS tea_answers (
  date text NOT NULL,
  round text NOT NULL,
  email text NOT NULL,
  going boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (date, round, email)
);
CREATE TABLE IF NOT EXISTS snack_picks (
  date text NOT NULL,
  voter_ref text NOT NULL,
  item_id text NOT NULL,
  PRIMARY KEY (date, voter_ref)
);
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS reply text;
CREATE TABLE IF NOT EXISTS notice_reports (
  notice_id text NOT NULL,
  reporter_ref text NOT NULL,
  at timestamptz NOT NULL,
  PRIMARY KEY (notice_id, reporter_ref)
);
CREATE TABLE IF NOT EXISTS closed_days (
  date text PRIMARY KEY,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);
-- The rebuilt member app: poll votes, the daily tea round, the snack shelf, the reading list
-- and birthdays (day and month only).
CREATE TABLE IF NOT EXISTS poll_votes (
  notice_id text NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  email text NOT NULL,
  option int NOT NULL,
  PRIMARY KEY (notice_id, email)
);
CREATE TABLE IF NOT EXISTS tea_rounds (
  date text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (date, email)
);
CREATE TABLE IF NOT EXISTS snack_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL,
  ordered_at timestamptz,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS snack_votes (
  item_id text NOT NULL REFERENCES snack_items(id) ON DELETE CASCADE,
  voter_ref text NOT NULL,
  PRIMARY KEY (item_id, voter_ref)
);
CREATE TABLE IF NOT EXISTS books (
  id text PRIMARY KEY,
  title text NOT NULL,
  author text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS readings (
  email text NOT NULL,
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status text NOT NULL,
  page int NOT NULL DEFAULT 0,
  pages int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (email, book_id)
);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birthday text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS show_birthday boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
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
  declaredMode: r.declared_mode ?? null,
  accuracyM: r.accuracy_m ?? null,
  source: r.source ?? null,
});
const snack = (r: any): SnackItem => ({
  id: r.id,
  name: r.name,
  note: r.note ?? "",
  status: r.status,
  orderedAt: r.ordered_at ? r.ordered_at.toISOString?.() ?? r.ordered_at : null,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const planOverride = (r: any): PlanOverrideRow => ({ email: r.email, date: r.date, planned: r.planned });
const closedDay = (r: any): ClosedDayRow => ({ date: r.date, reason: r.reason, createdBy: r.created_by, createdAt: r.created_at?.toISOString?.() ?? r.created_at });
const attendanceChange = (r: any): AttendanceChangeRow => ({
  id: r.id,
  email: r.email,
  date: r.date,
  from: r.from_mode ?? null,
  to: r.to_mode ?? null,
  by: r.changed_by,
  kind: r.kind,
  at: r.at?.toISOString?.() ?? r.at,
});
const grievance = (r: any): GrievanceRow => ({
  id: r.id,
  body: r.body,
  displayName: r.display_name,
  image: r.image ?? null,
  urgent: r.urgent === true,
  submitterRef: r.submitter_ref,
  status: r.status,
  updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at ?? r.created_at?.toISOString?.() ?? r.created_at,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
  topic: r.topic ?? null,
  reply: r.reply ?? null,
});
const wifi = (r: any): WifiRow => ({
  id: r.id,
  quality: r.quality,
  note: r.note,
  downMbps: r.down_mbps,
  upMbps: r.up_mbps,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
  area: r.area ?? null,
});
const announcement = (r: any): AnnouncementRow => ({
  id: r.id,
  title: r.title,
  body: r.body,
  tag: r.tag,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
  important: r.important ?? false,
  authorName: r.author_name ?? null,
  pinnedUntil: r.pinned_until ?? null,
});
// "owner" is the retired top role; such rows are admins now.
const roleOf = (role: unknown): Role => (role === "admin" || role === "owner" ? "admin" : "member");
const employee = (r: any): EmployeeRow => ({
  email: r.email,
  name: r.name,
  picture: r.picture,
  role: roleOf(r.role),
  joinedOn: r.joined_on ?? null,
  stepsOffset: r.steps_offset ?? 0,
  officeDays: Array.isArray(r.office_days) ? r.office_days : [],
  officeExempt: r.office_exempt ?? false,
  birthday: r.birthday ?? null,
  showBirthday: r.show_birthday ?? false,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
  lastSeenAt: r.last_seen_at?.toISOString?.() ?? r.last_seen_at,
  feedSeenAt: r.feed_seen_at ? r.feed_seen_at.toISOString?.() ?? r.feed_seen_at : null,
  stepsLeague: r.steps_league ?? false,
});
const pushSubscription = (r: any): PushSubscriptionRow => ({
  sessionRef: r.session_ref ?? null,
  sessionExpiresAt: r.session_expires_at?.toISOString?.() ?? r.session_expires_at ?? null,
  endpoint: r.endpoint,
  p256dh: r.p256dh,
  auth: r.auth,
  email: r.email ?? null,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const steps = (r: any): StepsRow => ({
  id: r.id,
  email: r.email,
  date: r.date,
  hit: r.hit === true,
  steps: r.steps ?? null,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const leaveBalance = (r: any): LeaveBalanceRow => ({
  email: r.email,
  year: Number(r.year),
  // Columns are nullable so an admin can leave a type blank rather than assert a zero.
  available: Object.fromEntries(
    (["cl", "sl", "el", "fl"] as const).filter((k) => r[k] !== null && r[k] !== undefined).map((k) => [k, Number(r[k])]),
  ),
  reconciledRequestIds: r.reconciled_request_ids ?? undefined,
  asOf: r.as_of?.toISOString?.() ?? r.as_of,
  updatedBy: r.updated_by ?? null,
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
  ...(r.updated_at ? {updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at} : {}),
  ...(r.cancelled_at ? {cancelledAt:r.cancelled_at?.toISOString?.() ?? r.cancelled_at} : {}),
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
  async addNotice(row: NoticeRow): Promise<NoticeRow> {
    const safe = row.anonymous ? { ...row, authorEmail: null, authorName: null } : row;
    await this.q(`INSERT INTO notices (id, data, created_at) VALUES ($1,$2::jsonb,$3)`, [safe.id, JSON.stringify(safe), safe.createdAt]);
    return safe;
  }
  async listNotices(limit: number): Promise<NoticeRow[]> {
    const res = await this.q(`SELECT data FROM notices ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows.map(r => r.data);
  }
  async deleteNotice(id: string) {
    const res = await this.q(`DELETE FROM notices WHERE id = $1`, [id]);
    return !!res.rowCount;
  }
  async toggleNoticeReaction(id: string, email: string, emoji: string) {
    // Lock the parent row so concurrent toggles cannot both observe an absent reaction.
    await this.init();
    const client = await this.db().connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(`SELECT id FROM notices WHERE id = $1 FOR UPDATE`, [id]);
      if (!found.rowCount) { await client.query("COMMIT"); return false; }
      const removed = await client.query(`DELETE FROM notice_reactions WHERE notice_id=$1 AND email=$2 AND emoji=$3`, [id,email,emoji]);
      if (!removed.rowCount) await client.query(`INSERT INTO notice_reactions (notice_id,email,emoji) VALUES ($1,$2,$3)`, [id,email,emoji]);
      await client.query("COMMIT");
      return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async listNoticeReactions(ids: string[]): Promise<NoticeReaction[]> {
    const res = await this.q(`SELECT notice_id AS "noticeId", email, emoji FROM notice_reactions WHERE notice_id = ANY($1::text[])`, [ids]);
    return res.rows;
  }
  async getWorkspaceProfile(email: string): Promise<WorkspaceProfile | null> {
    const res = await this.q(`SELECT email, data FROM workspace_profiles WHERE email = $1`, [email]);
    return res.rows[0] ? { ...res.rows[0].data, email } : null;
  }
  async listWorkspaceProfiles(): Promise<WorkspaceProfile[]> {
    const res = await this.q(`SELECT email, data FROM workspace_profiles ORDER BY email`);
    return res.rows.map((r) => ({ ...r.data, email: r.email }));
  }
  async saveWorkspaceProfile(email: string, patch: Partial<Omit<WorkspaceProfile, "email">>): Promise<WorkspaceProfile> {
    const defaults = { designation: "", department: "", project: "", floor: "", desk: "", focus: "", mode: null, presenceDate: "" };
    const res = await this.q(`INSERT INTO workspace_profiles (email, data) VALUES ($1, $2::jsonb)
      ON CONFLICT (email) DO UPDATE SET data = workspace_profiles.data || $3::jsonb RETURNING data`,
      [email, JSON.stringify({ ...defaults, ...patch }), JSON.stringify(patch)]);
    return { ...res.rows[0].data, email };
  }
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
        // One-time copy of the single-round tea list into per-round answers (they were all
        // afternoon "yes"). Runs after the whole schema, so both tables exist even on an empty
        // database, and a marker row makes it happen once, not on every start.
        const copied = await client.query(`SELECT 1 FROM settings WHERE key = 'migrated:tea_answers'`);
        if (!copied.rowCount) {
          await client.query(`INSERT INTO tea_answers (date, round, email, going, created_at) SELECT date, 'pm', email, true, created_at FROM tea_rounds ON CONFLICT DO NOTHING`);
          await client.query(`INSERT INTO settings (key, value) VALUES ('migrated:tea_answers', 'true'::jsonb) ON CONFLICT DO NOTHING`);
        }
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

  // One row per person per day: a fresh check-in reopens the day's row (back in = in again),
  // so the row's check_in_at is always the most recent arrival.
  async checkIn(row: AttendanceRow) {
    const res = await this.q(
      `INSERT INTO attendance (id, email, date, check_in_at, lat, lng, accuracy_m, declared_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (email, date) DO UPDATE
       SET declared_mode = CASE WHEN attendance.check_out_at IS NOT NULL THEN EXCLUDED.declared_mode ELSE CASE WHEN $9 THEN EXCLUDED.declared_mode ELSE attendance.declared_mode END END,
           check_in_at = CASE WHEN attendance.check_out_at IS NOT NULL THEN EXCLUDED.check_in_at ELSE attendance.check_in_at END,
           lat = CASE WHEN attendance.check_out_at IS NOT NULL THEN EXCLUDED.lat ELSE attendance.lat END,
           lng = CASE WHEN attendance.check_out_at IS NOT NULL THEN EXCLUDED.lng ELSE attendance.lng END,
           accuracy_m = CASE WHEN attendance.check_out_at IS NOT NULL THEN EXCLUDED.accuracy_m ELSE attendance.accuracy_m END,
           check_out_at = NULL
       RETURNING *`,
      [row.id, row.email, row.date, row.checkInAt, row.lat, row.lng, row.accuracyM, row.declaredMode ?? null, row.declaredMode !== undefined],
    );
    // Repeated check-in preserves arrival/evidence while allowing an explicit declaration change.
    return res.rows[0] ? attendance(res.rows[0]) : (await this.getAttendance(row.email, row.date))!;
  }
  async votePoll(noticeId: string, email: string, option: number | null) {
    const exists = await this.q(`SELECT 1 FROM notices WHERE id = $1`, [noticeId]);
    if (!exists.rowCount) return false;
    if (option === null) await this.q(`DELETE FROM poll_votes WHERE notice_id = $1 AND email = $2`, [noticeId, email]);
    else await this.q(`INSERT INTO poll_votes (notice_id, email, option) VALUES ($1,$2,$3) ON CONFLICT (notice_id, email) DO UPDATE SET option = EXCLUDED.option`, [noticeId, email, option]);
    return true;
  }
  async listPollVotes(ids: string[]) {
    if (!ids.length) return [];
    const res = await this.q(`SELECT notice_id, email, option FROM poll_votes WHERE notice_id = ANY($1)`, [ids]);
    return res.rows.map((r) => ({ noticeId: r.notice_id, email: r.email, option: r.option }));
  }
  // The afternoon round, for callers from before rounds existed.
  async setTea(date: string, email: string, going: boolean) {
    await this.setTeaAnswer(date, "pm", email, going ? true : null);
  }
  async listTea(date: string) {
    const res = await this.q(`SELECT * FROM tea_answers WHERE date = $1 AND round = 'pm' AND going ORDER BY created_at`, [date]);
    return res.rows.map((r) => ({ date: r.date, email: r.email, createdAt: r.created_at?.toISOString?.() ?? r.created_at }));
  }
  async setTeaAnswer(date: string, round: TeaRound, email: string, going: boolean | null) {
    if (going === null) await this.q(`DELETE FROM tea_answers WHERE date = $1 AND round = $2 AND email = $3`, [date, round, email]);
    else await this.q(`INSERT INTO tea_answers (date, round, email, going, created_at) VALUES ($1,$2,$3,$4,now()) ON CONFLICT (date, round, email) DO UPDATE SET going = EXCLUDED.going`, [date, round, email, going]);
  }
  async listTeaAnswers(date: string) {
    const res = await this.q(`SELECT * FROM tea_answers WHERE date = $1 ORDER BY created_at`, [date]);
    return res.rows.map((r) => ({ date: r.date, round: r.round as TeaRound, email: r.email, going: r.going, createdAt: r.created_at?.toISOString?.() ?? r.created_at }));
  }
  async setSnackPick(date: string, voterRef: string, itemId: string | null) {
    if (itemId === null) await this.q(`DELETE FROM snack_picks WHERE date = $1 AND voter_ref = $2`, [date, voterRef]);
    else await this.q(`INSERT INTO snack_picks (date, voter_ref, item_id) VALUES ($1,$2,$3) ON CONFLICT (date, voter_ref) DO UPDATE SET item_id = EXCLUDED.item_id`, [date, voterRef, itemId]);
  }
  async listSnackPicks(date: string) {
    const res = await this.q(`SELECT item_id, voter_ref FROM snack_picks WHERE date = $1`, [date]);
    return res.rows.map((r) => ({ itemId: r.item_id as string, voterRef: r.voter_ref as string }));
  }
  async getSetting<T = unknown>(key: string) {
    const res = await this.q(`SELECT value FROM settings WHERE key = $1`, [key]);
    return (res.rows[0]?.value ?? null) as T | null;
  }
  async setSetting(key: string, value: unknown) {
    await this.q(`INSERT INTO settings (key, value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, JSON.stringify(value)]);
  }
  async addSnack(row: SnackItem) {
    await this.q(`INSERT INTO snack_items (id, name, note, status, ordered_at, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [row.id, row.name, row.note, row.status, row.orderedAt, row.createdAt]);
    return row;
  }
  async getSnack(id: string) {
    const res = await this.q(`SELECT * FROM snack_items WHERE id = $1`, [id]);
    return res.rows[0] ? snack(res.rows[0]) : null;
  }
  async listSnacks() {
    const res = await this.q(`SELECT * FROM snack_items ORDER BY created_at`);
    return res.rows.map(snack);
  }
  async setSnackStatus(id: string, status: SnackItem["status"], orderedAt: string | null) {
    const res = await this.q(`UPDATE snack_items SET status = $2, ordered_at = $3 WHERE id = $1`, [id, status, orderedAt]);
    return (res.rowCount ?? 0) > 0;
  }
  async toggleSnackVote(itemId: string, voterRef: string) {
    const exists = await this.q(`SELECT 1 FROM snack_items WHERE id = $1`, [itemId]);
    if (!exists.rowCount) return null;
    const removed = await this.q(`DELETE FROM snack_votes WHERE item_id = $1 AND voter_ref = $2`, [itemId, voterRef]);
    if (removed.rowCount) return false;
    await this.q(`INSERT INTO snack_votes (item_id, voter_ref) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [itemId, voterRef]);
    return true;
  }
  async listSnackVotes() {
    const res = await this.q(`SELECT item_id, voter_ref FROM snack_votes`);
    return res.rows.map((r) => ({ itemId: r.item_id, voterRef: r.voter_ref }));
  }
  async clearSnackVotes(itemId: string) {
    await this.q(`DELETE FROM snack_votes WHERE item_id = $1`, [itemId]);
  }
  async addBook(row: BookRow) {
    await this.q(`INSERT INTO books (id, title, author, created_at) VALUES ($1,$2,$3,$4)`, [row.id, row.title, row.author, row.createdAt]);
    return row;
  }
  async listBooks() {
    const res = await this.q(`SELECT * FROM books ORDER BY created_at`);
    return res.rows.map((r) => ({ id: r.id, title: r.title, author: r.author, createdAt: r.created_at?.toISOString?.() ?? r.created_at }));
  }
  async setReading(row: ReadingRow) {
    await this.q(
      `INSERT INTO readings (email, book_id, status, page, pages, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email, book_id) DO UPDATE SET status = EXCLUDED.status, page = EXCLUDED.page, pages = EXCLUDED.pages, updated_at = EXCLUDED.updated_at`,
      [row.email, row.bookId, row.status, row.page, row.pages, row.updatedAt],
    );
    return row;
  }
  async clearReading(email: string, bookId: string) {
    await this.q(`DELETE FROM readings WHERE email = $1 AND book_id = $2`, [email, bookId]);
  }
  async listReadings() {
    const res = await this.q(`SELECT * FROM readings`);
    return res.rows.map((r) => ({ email: r.email, bookId: r.book_id, status: r.status, page: r.page, pages: r.pages, updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at }));
  }
  async setBirthday(email: string, birthday: string | null, show: boolean) {
    const res = await this.q(`UPDATE employees SET birthday = $2, show_birthday = $3 WHERE email = $1`, [email, birthday, show]);
    return (res.rowCount ?? 0) > 0;
  }
  async markDay(row: AttendanceRow) {
    const res = await this.q(
      `INSERT INTO attendance (id, email, date, check_in_at, lat, lng, accuracy_m, declared_mode, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (email, date) DO UPDATE
       SET check_in_at = EXCLUDED.check_in_at, check_out_at = NULL, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
           accuracy_m = EXCLUDED.accuracy_m, declared_mode = EXCLUDED.declared_mode, source = EXCLUDED.source
       RETURNING *`,
      [row.id, row.email, row.date, row.checkInAt, row.lat, row.lng, row.accuracyM, row.declaredMode ?? null, row.source ?? null],
    );
    return attendance(res.rows[0]);
  }
  async clearDay(email: string, date: string) {
    const res = await this.q(`DELETE FROM attendance WHERE email = $1 AND date = $2`, [email, date]);
    return (res.rowCount ?? 0) > 0;
  }
  async addAttendanceChange(row: AttendanceChangeRow) {
    await this.q(`INSERT INTO attendance_changes (id, email, date, from_mode, to_mode, changed_by, kind, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [row.id, row.email, row.date, row.from, row.to, row.by, row.kind, row.at]);
    return row;
  }
  async listAttendanceChanges(email: string, limit: number) {
    const res = await this.q(`SELECT * FROM attendance_changes WHERE email = $1 ORDER BY at DESC LIMIT $2`, [email, limit]);
    return res.rows.map(attendanceChange);
  }
  async setOfficeExempt(email: string, exempt: boolean) {
    const res = await this.q(`UPDATE employees SET office_exempt = $2 WHERE email = $1`, [email, exempt]);
    return (res.rowCount ?? 0) > 0;
  }
  async setPlanOverride(email: string, date: string, planned: boolean | null) {
    if (planned === null) await this.q(`DELETE FROM plan_overrides WHERE email = $1 AND date = $2`, [email, date]);
    else await this.q(`INSERT INTO plan_overrides (email, date, planned) VALUES ($1,$2,$3) ON CONFLICT (email, date) DO UPDATE SET planned = EXCLUDED.planned`, [email, date, planned]);
  }
  async listPlanOverrides(email: string, from: string, to: string) {
    const res = await this.q(`SELECT email, date, planned FROM plan_overrides WHERE email = $1 AND date >= $2 AND date <= $3 ORDER BY date`, [email, from, to]);
    return res.rows.map(planOverride);
  }
  async listPlanOverridesOn(date: string) {
    const res = await this.q(`SELECT email, date, planned FROM plan_overrides WHERE date = $1 ORDER BY email`, [date]);
    return res.rows.map(planOverride);
  }
  async listClosedDays(from: string, to: string) {
    const res = await this.q(`SELECT * FROM closed_days WHERE date >= $1 AND date <= $2 ORDER BY date`, [from, to]);
    return res.rows.map(closedDay);
  }
  async addClosedDay(row: ClosedDayRow) {
    const res = await this.q(`INSERT INTO closed_days (date, reason, created_by, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (date) DO NOTHING`, [row.date, row.reason, row.createdBy, row.createdAt]);
    return (res.rowCount ?? 0) > 0;
  }
  async removeClosedDay(date: string) {
    const res = await this.q(`DELETE FROM closed_days WHERE date = $1`, [date]);
    return (res.rowCount ?? 0) > 0;
  }
  async setOfficeDays(email: string, days: number[]) {
    const res = await this.q(`UPDATE employees SET office_days = $2::jsonb WHERE email = $1`, [email, JSON.stringify([...days].sort((a, b) => a - b))]);
    return (res.rowCount ?? 0) > 0;
  }
  async checkOut(email: string, date: string, at: string) {
    const res = await this.q(
      `UPDATE attendance SET check_out_at = $3 WHERE email = $1 AND date = $2 AND check_out_at IS NULL RETURNING *`,
      [email, date, at],
    );
    return res.rows[0] ? attendance(res.rows[0]) : null;
  }
  async getAttendance(email: string, date: string) {
    const res = await this.q(`SELECT * FROM attendance WHERE email = $1 AND date = $2`, [email, date]);
    return res.rows[0] ? attendance(res.rows[0]) : null;
  }
  async listAttendanceRange(email: string, fromDate: string, toDate: string) {
    const res = await this.q(
      `SELECT * FROM attendance WHERE email = $1 AND date BETWEEN $2 AND $3 ORDER BY date, check_in_at`,
      [email, fromDate, toDate],
    );
    return res.rows.map(attendance);
  }
  async listAttendance(date: string) {
    const res = await this.q(`SELECT * FROM attendance WHERE date = $1 ORDER BY check_in_at`, [date]);
    return res.rows.map(attendance);
  }
  async addGrievance(row: GrievanceRow) {
    const res = await this.q(
      `INSERT INTO grievances (id, body, display_name, image, urgent, submitter_ref, status, created_at, topic)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      // Never persist a device-linked ref — "anonymous" must survive a DB leak.
      [row.id, row.body, row.displayName, row.image, row.urgent, "anon", row.status, row.createdAt, row.topic ?? null],
    );
    return grievance(res.rows[0]);
  }
  async setGrievanceStatus(id: string, status: GrievanceStatus) {
    const res = await this.q(`UPDATE grievances SET status = $2, updated_at = NOW() WHERE id = $1`, [id, status]);
    return (res.rowCount ?? 0) > 0;
  }
  async setGrievanceReply(id: string, reply: string | null) {
    const res = await this.q(`UPDATE grievances SET reply = $2, updated_at = NOW() WHERE id = $1`, [id, reply]);
    return (res.rowCount ?? 0) > 0;
  }
  async addNoticeReport(noticeId: string, reporterRef: string) {
    const res = await this.q(`INSERT INTO notice_reports (notice_id, reporter_ref, at) VALUES ($1,$2,now()) ON CONFLICT DO NOTHING`, [noticeId, reporterRef]);
    return (res.rowCount ?? 0) > 0;
  }
  async countNoticeReports() {
    const res = await this.q(`SELECT notice_id, count(*)::int AS n FROM notice_reports GROUP BY notice_id`);
    return Object.fromEntries(res.rows.map((r: any) => [r.notice_id, r.n as number]));
  }
  async listGrievances() {
    const res = await this.q(`SELECT * FROM grievances ORDER BY urgent DESC, created_at DESC`);
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
      `INSERT INTO wifi (id, quality, note, down_mbps, up_mbps, created_at, area)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [row.id, row.quality, row.note, row.downMbps, row.upMbps, row.createdAt, row.area ?? null],
    );
    return wifi(res.rows[0]);
  }
  async listWifi(limit: number) {
    const res = await this.q(`SELECT * FROM wifi ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows.map(wifi);
  }
  async addAnnouncement(row: AnnouncementRow) {
    const res = await this.q(
      `INSERT INTO announcements (id, title, body, tag, created_at, important, author_name, pinned_until) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [row.id, row.title, row.body, row.tag, row.createdAt, row.important ?? false, row.authorName ?? null, row.pinnedUntil ?? null],
    );
    return announcement(res.rows[0]);
  }
  async getAnnouncement(id:string) {const res=await this.q(`SELECT * FROM announcements WHERE id=$1`,[id]);return res.rows[0]?announcement(res.rows[0]):null;}
  async deleteAnnouncement(id: string) {
    await this.q(`DELETE FROM announcements WHERE id = $1`, [id]);
  }
  async listAnnouncements(limit: number) {
    const res = await this.q(`SELECT * FROM announcements ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows.map(announcement);
  }
  async ackAnnouncement(id: string, email: string) {
    await this.q(`INSERT INTO announcement_acks (announcement_id, email, at) VALUES ($1,$2,now()) ON CONFLICT DO NOTHING`, [id, email]);
  }
  async listAckedAnnouncementIds(email: string) {
    const res = await this.q(`SELECT announcement_id FROM announcement_acks WHERE email = $1`, [email]);
    return res.rows.map((r: any) => r.announcement_id as string);
  }
  async countAnnouncementAcks(ids: string[]) {
    const res = await this.q(`SELECT announcement_id, count(*)::int AS n FROM announcement_acks WHERE announcement_id = ANY($1) GROUP BY announcement_id`, [ids]);
    return Object.fromEntries(ids.map((id) => [id, res.rows.find((r: any) => r.announcement_id === id)?.n ?? 0]));
  }
  async setStepsLeague(email: string, on: boolean) {
    const res = await this.q(`UPDATE employees SET steps_league = $2 WHERE email = $1`, [email, on]);
    return (res.rowCount ?? 0) > 0;
  }
  async addNudge(date: string, from: string, to: string) {
    const res = await this.q(`INSERT INTO nudges (date, from_email, to_email) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [date, from, to]);
    return (res.rowCount ?? 0) > 0;
  }
  async listNudgesFrom(date: string, from: string) {
    const res = await this.q(`SELECT to_email FROM nudges WHERE date = $1 AND from_email = $2`, [date, from]);
    return res.rows.map((r: any) => r.to_email as string);
  }
  async setFeedSeenAt(email: string, at: string) {
    await this.q(`UPDATE employees SET feed_seen_at = $2 WHERE email = $1 AND (feed_seen_at IS NULL OR feed_seen_at < $2)`, [email, at]);
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
  async setStepsOffset(email: string, days: number) {
    const res = await this.q(`UPDATE employees SET steps_offset = $2 WHERE email = $1`, [email, days]);
    return (res.rowCount ?? 0) > 0;
  }
  async setSteps(row: StepsRow) {
    const res = await this.q(
      `INSERT INTO steps (id, email, date, hit, steps, created_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email, date) DO UPDATE SET hit = $4, steps = $5 RETURNING *`,
      [row.id, row.email, row.date, row.hit, row.steps, row.createdAt],
    );
    return steps(res.rows[0]);
  }
  async addSteps(email: string, date: string, add: number) {
    const res = await this.q(
      `INSERT INTO steps (id, email, date, hit, steps, created_at) VALUES ($1,$2,$3,$4 >= 10000,LEAST($4, 200000),now())
       ON CONFLICT (email, date) DO UPDATE SET steps = LEAST(COALESCE(steps.steps, 0) + $4, 200000), hit = LEAST(COALESCE(steps.steps, 0) + $4, 200000) >= 10000
       RETURNING steps`,
      [crypto.randomUUID(), email, date, add],
    );
    return Number(res.rows[0].steps);
  }
  async listSteps() {
    const res = await this.q(`SELECT * FROM steps ORDER BY date DESC`);
    return res.rows.map(steps);
  }
  async listStepsByEmail(email: string, limit: number) {
    const res = await this.q(`SELECT * FROM steps WHERE email = $1 ORDER BY date DESC LIMIT $2`, [email, limit]);
    return res.rows.map(steps);
  }
  async setLeaveBalance(row: LeaveBalanceRow) {
    const a = row.available;
    const res = await this.q(
      `INSERT INTO leave_balances (email, year, cl, sl, el, fl, as_of, updated_by, reconciled_request_ids) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (email, year) DO UPDATE SET cl = $3, sl = $4, el = $5, fl = $6, as_of = $7, updated_by = $8, reconciled_request_ids=$9::jsonb RETURNING *`,
      [row.email, row.year, a.cl ?? null, a.sl ?? null, a.el ?? null, a.fl ?? null, row.asOf, row.updatedBy, row.reconciledRequestIds === undefined ? null : JSON.stringify(row.reconciledRequestIds)],
    );
    return leaveBalance(res.rows[0]);
  }
  async listLeaveBalances(year: number) {
    const res = await this.q(`SELECT * FROM leave_balances WHERE year = $1`, [year]);
    return res.rows.map(leaveBalance);
  }
  async savePushSubscription(row: PushSubscriptionRow) {
    const res = await this.q(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, email, created_at, session_ref, session_expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3, email = $4, session_ref=$6, session_expires_at=$7 RETURNING *`,
      [row.endpoint, row.p256dh, row.auth, row.email, row.createdAt, row.sessionRef ?? null, row.sessionExpiresAt ?? null],
    );
    return pushSubscription(res.rows[0]);
  }
  async deletePushSubscription(endpoint: string) {
    const res = await this.q(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
    return (res.rowCount ?? 0) > 0;
  }
  async revokePushSession(ref: string) { await this.q(`DELETE FROM push_subscriptions WHERE session_ref=$1`, [ref]); }
  async listPushSubscriptions(email?: string) {
    const res = email
      ? await this.q(`SELECT * FROM push_subscriptions WHERE email = $1`, [email])
      : await this.q(`SELECT * FROM push_subscriptions`);
    return res.rows.map(pushSubscription);
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
  async getAway(id: string) { const res = await this.q(`SELECT * FROM away WHERE id=$1`, [id]); return res.rows[0] ? away(res.rows[0]) : null; }
  async listPendingAway() { const res = await this.q(`SELECT * FROM away WHERE status='pending' ORDER BY created_at DESC`); return res.rows.map(away); }
  async setAwayStatus(id: string, status: AwayStatus, decidedBy: string | null, decidedAt: string, expected: AwayStatus) {
    const res = await this.q(`UPDATE away SET status = $2, decided_by = $3, decided_at = $4 WHERE id = $1 AND status=$5`, [
      id,
      status,
      decidedBy,
      decidedAt,
      expected,
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
  async updateEvent(rid: string, expected: string, patch: Pick<EventRow,"title"|"body"|"category"|"startsAt"|"location"> & {cancelledAt?:string}, updatedAt:string) {
    const res=await this.q(`UPDATE events SET title=$3,body=$4,category=$5,starts_at=$6,location=$7,updated_at=$8,cancelled_at=COALESCE($9::timestamptz,cancelled_at) WHERE id=$1 AND COALESCE(updated_at,created_at)=$2::timestamptz RETURNING *`,[rid,expected,patch.title,patch.body,patch.category,patch.startsAt,patch.location,updatedAt,patch.cancelledAt??null]);
    return res.rows[0]?event(res.rows[0]):null;
  }
  async deleteEvent(rid: string, expected?:string) {
    const res = expected ? await this.q(`DELETE FROM events WHERE id = $1 AND COALESCE(updated_at,created_at)=$2::timestamptz`, [rid,expected]) : await this.q(`DELETE FROM events WHERE id = $1`, [rid]);
    return (res.rowCount ?? 0) > 0;
  }
  async listEvents(fromIso: string, limit: number) {
    const res = await this.q(`SELECT * FROM events WHERE starts_at >= $1 ORDER BY starts_at ASC LIMIT $2`, [fromIso, limit]);
    return res.rows.map(event);
  }
  async setRsvp(eventId: string, ref: string, email: string | null, going: boolean) {
    await this.init();
    const client = await this.db().connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`rsvp:${eventId}:${email ?? ref}`]);
      const active=await client.query(`SELECT id,cancelled_at FROM events WHERE id=$1 FOR UPDATE`,[eventId]);
      if(!active.rows[0]||active.rows[0].cancelled_at){await client.query("COMMIT");return false;}
      if (email) await client.query(`DELETE FROM event_rsvps WHERE event_id=$1 AND email=$2 AND (NOT $3 OR submitter_ref<>$4)`, [eventId,email,going,ref]);
      if (going) await client.query(`INSERT INTO event_rsvps (event_id, submitter_ref, email, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (event_id,submitter_ref) DO UPDATE SET email=EXCLUDED.email`, [eventId,ref,email,new Date().toISOString()]);
      else await client.query(`DELETE FROM event_rsvps WHERE event_id=$1 AND submitter_ref=$2`, [eventId,ref]);
      await client.query("COMMIT");return true;
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
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
      `SELECT event_id, COUNT(DISTINCT COALESCE(email, submitter_ref))::int AS n FROM event_rsvps WHERE event_id = ANY($1) GROUP BY event_id`,
      [eventIds],
    );
    return Object.fromEntries(res.rows.map((r: any) => [r.event_id, r.n]));
  }
  async myRsvpEventIds(ref: string, email?: string) {
    const res = await this.q(`SELECT DISTINCT event_id FROM event_rsvps WHERE submitter_ref = $1 OR email=$2`, [ref, email ?? null]);
    return res.rows.map((r: any) => r.event_id);
  }
}

export const pgStore = new PgStore();
