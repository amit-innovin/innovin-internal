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
  listGrievancesByRef(ref: string, limit: number): Promise<GrievanceRow[]>;
  addWifi(row: WifiRow): Promise<WifiRow>;
  listWifi(limit: number): Promise<WifiRow[]>;
  addAnnouncement(row: AnnouncementRow): Promise<AnnouncementRow>;
  deleteAnnouncement(id: string): Promise<void>;
  listAnnouncements(limit: number): Promise<AnnouncementRow[]>;
}
