import { locationTag } from "./geo";
import type { AttendanceRow } from "./types";
export function attendanceLocation(row: AttendanceRow) { return row.declaredMode ?? locationTag(row.lat, row.lng); }
