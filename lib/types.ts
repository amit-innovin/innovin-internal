import type { LeaveType } from "./leave";

// owner  — can grant/revoke admin; cannot be demoted by anyone else
// admin  — the dashboard powers (approvals, publishing, order lists)
// member — the default on first sign-in
export type Role = "owner" | "admin" | "member";

export type EmployeeRow = {
  email: string;
  name: string;
  picture: string;
  role: Role;
  // Date of joining (YYYY-MM-DD), admin-entered. Drives Earned Leave accrual, the one-year
  // availing gate, and Flexible Leave pro-rating. Null until someone fills it in.
  joinedOn: string | null;
  // Days hit before the app took over the 10K challenge — copied from the sheet by an admin.
  stepsOffset: number;
  createdAt: string;
  lastSeenAt: string;
};

// 10K steps challenge: one row per person per day. `hit` is the toggle; `steps` is the
// optional actual count for people who want to share it.
export type StepsRow = {
  id: string;
  email: string;
  date: string;
  hit: boolean;
  steps: number | null;
  createdAt: string;
};

export type AttendanceRow = {
  id: string;
  email: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  // Where the check-in happened, if the device shared it.
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  declaredMode?: "office" | "remote" | null;
};

export type OrderRow = {
  id: string;
  date: string;
  itemId: string;
  preference: string;
  instructions: string;
  submitterRef: string;
  orderedBy?: string;
  createdAt: string;
};

export type AwayType = "leave" | "wfh";
export type AwayStatus = "pending" | "approved" | "rejected" | "cancelled";

export type AwayRow = {
  id: string;
  email: string;
  type: AwayType;
  // Which leave bucket this draws from (null for WFH, and for rows predating leave types).
  leaveType: LeaveType | null;
  halfDay: boolean;
  // Working days charged, frozen at submission so a later holiday-calendar change can't
  // retroactively alter someone's history.
  days: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  reason: string;
  status: AwayStatus;
  submitterRef: string;
  // Who approved/rejected it, for an audit trail. Null while pending, or when
  // decided via the break-glass PIN (which carries no identity).
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

// A person's leave balances as recorded in Zoho People, typed in by an admin. Zoho is the
// system of record. asOf is freshness only; reconciledRequestIds explicitly identifies
// app approvals reflected in the copied amounts. Other approvals remain estimated deductions.
export type LeaveBalanceRow = {
  email: string;
  year: number;
  available: Partial<Record<"cl" | "sl" | "el" | "fl", number>>;
  asOf: string;
  updatedBy: string | null;
  reconciledRequestIds?: string[];
};

// A browser's push subscription. `email` is set when the device is signed in, which is what
// lets a leave decision reach the right person; broadcasts go to every row.
//
// Deliberately never linked to a grievance: push is server-initiated with no request context,
// so delivering a grievance update would require storing exactly the grievance→device join that
// anonymity forbids. Grievance updates appear in the in-app feed only.
export type PushSubscriptionRow = {
  sessionRef?: string | null;
  sessionExpiresAt?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  email: string | null;
  createdAt: string;
};

export type EventCategory = "sports" | "arts" | "culture" | "learning" | "social" | "company";

export type EventRow = {
  id: string;
  title: string;
  body: string;
  category: EventCategory;
  startsAt: string; // ISO
  location: string;
  createdBy: string; // admin email or "admin"
  createdAt: string;
};

export type RsvpRow = {
  eventId: string;
  submitterRef: string;
  email: string | null; // verified Google email when signed in
  createdAt: string;
};

export type GrievanceStatus = "open" | "in_progress" | "resolved";

export type GrievanceRow = {
  id: string;
  body: string;
  displayName: string | null;
  image: string | null;
  // "can't wait" — admins see these first and get a push. Still anonymous either way.
  urgent: boolean;
  submitterRef: string;
  status: GrievanceStatus;
  updatedAt?: string;
  createdAt: string;
};

// A one-line ping between two people — "chai?", "walk?". Deliberately ephemeral: stores purge
// rows older than PING_TTL on every access, so there is no chat history to keep or leak.
export type PingRow = {
  id: string;
  fromEmail: string;
  toEmail: string;
  body: string;
  readAt: string | null;
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

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  tag: string;
  createdAt: string;
};

export type WorkspaceProfile = {
  email: string;
  designation: string;
  department: string;
  project: string;
  floor: string;
  desk: string;
  focus: string;
  mode: "office" | "remote" | null;
  presenceDate: string;
};

export type PlannerKind = "office" | "remote" | "vacation" | "sick" | "festival" | "holiday";
export type PlannerDay = { email: string; date: string; kind: PlannerKind };

export type NoticeRow = {
  id: string;
  kind: "quote" | "feedback";
  title: string;
  body: string;
  attribution: string;
  color: "yellow" | "peach" | "blue" | "green" | "purple";
  anonymous: boolean;
  authorEmail: string | null;
  authorName: string | null;
  createdAt: string;
};
export type NoticeReaction = { noticeId: string; email: string; emoji: string };

export interface Store {
  addNotice(row: NoticeRow): Promise<NoticeRow>;
  listNotices(limit: number): Promise<NoticeRow[]>;
  deleteNotice(id: string): Promise<boolean>;
  toggleNoticeReaction(id: string, email: string, emoji: string): Promise<boolean>;
  listNoticeReactions(ids: string[]): Promise<NoticeReaction[]>;
  getWorkspaceProfile(email: string): Promise<WorkspaceProfile | null>;
  listWorkspaceProfiles(): Promise<WorkspaceProfile[]>;
  saveWorkspaceProfile(email: string, patch: Partial<Omit<WorkspaceProfile, "email">>): Promise<WorkspaceProfile>;
  setPlannerDay(row: PlannerDay): Promise<void>;
  deletePlannerDay(email: string, date: string): Promise<void>;
  listPlannerDays(email: string, from: string, to: string): Promise<PlannerDay[]>;
  // Returns the open session if one exists, otherwise inserts a new one.
  checkIn(row: AttendanceRow): Promise<AttendanceRow>;
  // Closes the open session; null when there isn't one.
  checkOut(email: string, date: string, at: string): Promise<AttendanceRow | null>;
  // The currently open session, or null.
  getAttendance(email: string, date: string): Promise<AttendanceRow | null>;
  // One person's day rows across a date range (inclusive), for the attendance calendar.
  listAttendanceRange(email: string, fromDate: string, toDate: string): Promise<AttendanceRow[]>;
  listAttendance(date: string): Promise<AttendanceRow[]>;
  // 10K challenge: one row per person per day — today is the only writable day.
  setSteps(row: StepsRow): Promise<StepsRow>;
  listSteps(): Promise<StepsRow[]>;
  listStepsByEmail(email: string, limit: number): Promise<StepsRow[]>;
  // Replaces the device's selection for the day (atomically in Postgres).
  setDayOrders(date: string, ref: string, rows: OrderRow[]): Promise<OrderRow[]>;
  listOrders(date: string): Promise<OrderRow[]>;
  listOrdersByRef(ref: string, limit: number): Promise<OrderRow[]>;
  deleteOrder(ref: string, date: string): Promise<boolean>;
  addGrievance(row: GrievanceRow): Promise<GrievanceRow>;
  setGrievanceStatus(id: string, status: GrievanceStatus): Promise<boolean>;
  listGrievances(): Promise<GrievanceRow[]>;
  // "My submissions" lookup — ids come from the device's own cookie, never a stored ref.
  listGrievancesByIds(ids: string[], limit: number): Promise<GrievanceRow[]>;
  // Pings — both sides of every conversation `email` is part of, newest first.
  addPing(row: PingRow): Promise<PingRow>;
  listPingsFor(email: string, limit: number): Promise<PingRow[]>;
  // Marks unread pings sent to `email` by `fromEmail` as read.
  markPingsRead(email: string, fromEmail: string): Promise<void>;
  addWifi(row: WifiRow): Promise<WifiRow>;
  listWifi(limit: number): Promise<WifiRow[]>;
  addAnnouncement(row: AnnouncementRow): Promise<AnnouncementRow>;
  deleteAnnouncement(id: string): Promise<void>;
  listAnnouncements(limit: number): Promise<AnnouncementRow[]>;
  addAway(row: AwayRow): Promise<AwayRow>;
  setAwayStatus(id: string, status: AwayStatus, decidedBy: string | null, decidedAt: string, expected: AwayStatus): Promise<boolean>;
  getAway(id: string): Promise<AwayRow | null>;
  listPendingAway(): Promise<AwayRow[]>;
  listAway(limit: number): Promise<AwayRow[]>;
  listAwayByRef(ref: string, limit: number): Promise<AwayRow[]>;
  // A verified employee's requests across all their devices.
  listAwayByEmail(email: string, limit: number): Promise<AwayRow[]>;
  addEvent(row: EventRow): Promise<EventRow>;
  getEvent(id: string): Promise<EventRow | null>;
  deleteEvent(id: string): Promise<boolean>;
  // Upcoming events (startsAt >= fromIso), soonest first.
  listEvents(fromIso: string, limit: number): Promise<EventRow[]>;
  // Signed-in RSVPs follow email ownership; guest RSVPs follow their browser capability.
  setRsvp(eventId: string, ref: string, email: string | null, going: boolean): Promise<void>;
  listRsvps(eventId: string): Promise<RsvpRow[]>;
  rsvpCounts(eventIds: string[]): Promise<Record<string, number>>;
  myRsvpEventIds(ref: string, email?: string): Promise<string[]>;
  // Creates the employee on first sign-in; refreshes name/picture/lastSeenAt afterwards.
  upsertEmployee(row: EmployeeRow): Promise<EmployeeRow>;
  getEmployee(email: string): Promise<EmployeeRow | null>;
  listEmployees(): Promise<EmployeeRow[]>;
  setRole(email: string, role: Role): Promise<boolean>;
  setJoinedOn(email: string, joinedOn: string | null): Promise<boolean>;
  // Days hit before the app took over tracking — admin-entered from the old sheet.
  setStepsOffset(email: string, days: number): Promise<boolean>;
  setLeaveBalance(row: LeaveBalanceRow): Promise<LeaveBalanceRow>;
  listLeaveBalances(year: number): Promise<LeaveBalanceRow[]>;
  savePushSubscription(row: PushSubscriptionRow): Promise<PushSubscriptionRow>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  revokePushSession(sessionRef: string): Promise<void>;
  // `email` narrows to one person's devices; omit it to broadcast.
  listPushSubscriptions(email?: string): Promise<PushSubscriptionRow[]>;
}
