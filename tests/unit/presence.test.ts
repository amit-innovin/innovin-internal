import { afterEach, expect, it, vi } from "vitest";
import { attendanceMode, attendanceLocation } from "@/lib/presence";
import type { AttendanceRow } from "@/lib/types";
afterEach(() => vi.unstubAllEnvs());
const row: AttendanceRow = { id: "a", email: "a@innovinlabs.com", date: "2026-10-26", checkInAt: "2026-10-26T04:00:00Z", checkOutAt: null, lat: 12, lng: 77, accuracyM: 5 };
it("uses one effective presence for declared and geolocated attendance", () => {
  vi.stubEnv("OFFICE_LAT", "12"); vi.stubEnv("OFFICE_LNG", "77");
  expect(attendanceMode(row)).toBe("office");
  expect(attendanceLocation({ ...row, declaredMode: "remote" })).toBe("remote");
  expect(attendanceMode({ ...row, checkOutAt: "2026-10-26T05:00:00Z" })).toBeNull();
  expect(attendanceMode(null)).toBeNull();
});
