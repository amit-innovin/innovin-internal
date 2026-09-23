// Display helpers — everything is shown in office time (IST).
const TZ = "Asia/Kolkata";

const parts = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

const istDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export function fmtDay(date = new Date()) {
  const p = parts(date, { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday}, ${p.day} ${p.month}`;
}

export function fmtShortDate(iso: string) {
  const p = parts(new Date(iso), { day: "numeric", month: "short" });
  return `${p.day} ${p.month}`;
}

export function relativeDay(iso: string, now = Date.now()) {
  const days = Math.round((Date.parse(istDate(new Date(now))) - Date.parse(istDate(new Date(iso)))) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

// 11 → "11:00 AM", 15 → "3:00 PM", 0 → "12:00 AM", 24 (end of day) → "midnight".
export function fmtHour(hour: number) {
  if (hour >= 24) return "midnight";
  return `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? "AM" : "PM"}`;
}

// 247 → "4h 7m", 45 → "45m".
export function fmtDuration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

// Minutes covered by one attendance session; an open session counts up to `now`.
export function sessionMinutes(s: { checkInAt: string; checkOutAt: string | null }, now = Date.now()) {
  return Math.max(0, ((s.checkOutAt ? Date.parse(s.checkOutAt) : now) - Date.parse(s.checkInAt)) / 60_000);
}

export const totalMinutes = (sessions: { checkInAt: string; checkOutAt: string | null }[], now = Date.now()) =>
  Math.round(sessions.reduce((sum, s) => sum + sessionMinutes(s, now), 0));

// Inclusive calendar days spanned by a leave range ("2026-10-01" → "2026-10-02" = 2).
export function leaveDays(startDate: string, endDate: string) {
  return Math.max(0, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1);
}

export function relativeTime(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return relativeDay(iso, now);
}

export function greeting(date = new Date()) {
  const hour = parseInt(parts(date, { hour: "numeric", hourCycle: "h23" }).hour, 10);
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const nameParts = (email: string) => email.split("@")[0].split(/[._-]/).filter(Boolean);

export function firstName(email: string | null) {
  const first = email ? nameParts(email)[0] : undefined;
  return first ? first[0].toUpperCase() + first.slice(1) : null;
}

export const initials = (email: string) =>
  nameParts(email)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
