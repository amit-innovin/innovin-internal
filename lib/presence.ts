import { locationTag } from "./geo";
import type { AttendanceRow } from "./types";
export function attendanceLocation(row: AttendanceRow) { return row.declaredMode ?? locationTag(row.lat, row.lng); }
export function attendanceMode(row: AttendanceRow | null | undefined) {
  if (!row || row.checkOutAt) return null;
  const mode = attendanceLocation(row);
  return mode === "office" || mode === "remote" ? mode : null;
}
