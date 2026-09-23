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
  createdAt: string;
  lastSeenAt: string;
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

export type AwayType = "leave" | "wfh";
export type AwayStatus = "pending" | "approved" | "rejected";

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
// system of record; this is a snapshot, so `asOf` matters — anything requested through this app
// after that moment is counted on top, and everything before it is already reflected.
export type LeaveBalanceRow = {
  email: string;
  year: number;
  available: Partial<Record<"cl" | "sl" | "el" | "fl", number>>;
  asOf: string;
  updatedBy: string | null;
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
  submitterRef: string;
  status: GrievanceStatus;
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

export interface Store {
  // Returns the open session if one exists, otherwise inserts a new one.
  checkIn(row: AttendanceRow): Promise<AttendanceRow>;
  // Closes the open session; null when there isn't one.
  checkOut(email: string, date: string, at: string): Promise<AttendanceRow | null>;
  // The currently open session, or null.
  getAttendance(email: string, date: string): Promise<AttendanceRow | null>;
  listAttendanceByEmail(email: string, date: string): Promise<AttendanceRow[]>;
  // One person's sessions across a date range (inclusive), for the attendance calendar.
  listAttendanceRange(email: string, fromDate: string, toDate: string): Promise<AttendanceRow[]>;
  listAttendance(date: string): Promise<AttendanceRow[]>;
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
  addWifi(row: WifiRow): Promise<WifiRow>;
  listWifi(limit: number): Promise<WifiRow[]>;
  addAnnouncement(row: AnnouncementRow): Promise<AnnouncementRow>;
  deleteAnnouncement(id: string): Promise<void>;
  listAnnouncements(limit: number): Promise<AnnouncementRow[]>;
  addAway(row: AwayRow): Promise<AwayRow>;
  setAwayStatus(id: string, status: AwayStatus, decidedBy: string | null, decidedAt: string): Promise<boolean>;
  listAway(limit: number): Promise<AwayRow[]>;
  listAwayByRef(ref: string, limit: number): Promise<AwayRow[]>;
  // A verified employee's requests across all their devices.
  listAwayByEmail(email: string, limit: number): Promise<AwayRow[]>;
  addEvent(row: EventRow): Promise<EventRow>;
  getEvent(id: string): Promise<EventRow | null>;
  deleteEvent(id: string): Promise<boolean>;
  // Upcoming events (startsAt >= fromIso), soonest first.
  listEvents(fromIso: string, limit: number): Promise<EventRow[]>;
  // One RSVP per device per event; email recorded only for signed-in employees.
  setRsvp(eventId: string, ref: string, email: string | null, going: boolean): Promise<void>;
  listRsvps(eventId: string): Promise<RsvpRow[]>;
  rsvpCounts(eventIds: string[]): Promise<Record<string, number>>;
  myRsvpEventIds(ref: string): Promise<string[]>;
  // Creates the employee on first sign-in; refreshes name/picture/lastSeenAt afterwards.
  upsertEmployee(row: EmployeeRow): Promise<EmployeeRow>;
  getEmployee(email: string): Promise<EmployeeRow | null>;
  listEmployees(): Promise<EmployeeRow[]>;
  setRole(email: string, role: Role): Promise<boolean>;
  setJoinedOn(email: string, joinedOn: string | null): Promise<boolean>;
  setLeaveBalance(row: LeaveBalanceRow): Promise<LeaveBalanceRow>;
  listLeaveBalances(year: number): Promise<LeaveBalanceRow[]>;
}
