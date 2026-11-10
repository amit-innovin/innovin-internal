import { validDate } from "./time";
export type AttendanceTab = "today" | "calendar" | "leave";
export function attendanceHref(tab: AttendanceTab, date?: string, request?: string) {
  const params = new URLSearchParams({tab});
  if (date && validDate(date)) params.set("date",date);
  if (request) params.set("request",request);
  return `/attendance?${params}`;
}
export function attendanceView(params: Pick<URLSearchParams,"get">, today: string) {
  const tab: AttendanceTab = params.get("tab")==="leave" ? "leave" : params.get("tab")==="calendar" ? "calendar" : "today";
  const raw=params.get("date"), date=raw && validDate(raw) ? raw : null;
  const month= params.get("month");
  return { tab,date,month:date?.slice(0,7) ?? (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month:today.slice(0,7)),request:params.get("request") };
}
export function boardHref(id?: string) {
  return `/?view=board${id ? `&announcement=${encodeURIComponent(id)}#announcement-${encodeURIComponent(id)}` : ""}`;
}
export function eventHref(id: string) { return `/events?event=${encodeURIComponent(id)}#event-${encodeURIComponent(id)}`; }
