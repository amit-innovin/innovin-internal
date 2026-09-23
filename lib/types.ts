export type EmployeeRow = {
  email: string;
  name: string;
  picture: string;
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
  startDate: string; // YYYY-MM-DD
  endDate: string;
  reason: string;
  status: AwayStatus;
  submitterRef: string;
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
  setAwayStatus(id: string, status: AwayStatus): Promise<boolean>;
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
}
