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

export interface Store {
  checkIn(row: AttendanceRow): Promise<AttendanceRow>;
  checkOut(email: string, date: string, at: string): Promise<AttendanceRow | null>;
  getAttendance(email: string, date: string): Promise<AttendanceRow | null>;
  listAttendance(date: string): Promise<AttendanceRow[]>;
  upsertOrder(row: OrderRow): Promise<OrderRow>;
  listOrders(date: string): Promise<OrderRow[]>;
  addGrievance(row: GrievanceRow): Promise<GrievanceRow>;
  setGrievanceStatus(id: string, status: GrievanceStatus): Promise<void>;
  listGrievances(): Promise<GrievanceRow[]>;
  addWifi(row: WifiRow): Promise<WifiRow>;
  listWifi(limit: number): Promise<WifiRow[]>;
}
