// What the admin area shows: today across the office, and everyone's office days this month.
// Server-only: reads the store. Office-day rules stay in lib/office-days.ts.
import { closedMap, dayMode } from "./days";
import { isWorkingDay } from "./leave";
import { monthBounds, scheduleLabel } from "./office-days";
import { snackTimes } from "./snack-times";
import { currentRound } from "./snacks-rules";
import { store } from "./store";
import { todayIST } from "./time";
import type { AttendanceRow, AwayRow, EmployeeRow } from "./types";

// Remote isn't a mark any more: anyone not checked in and not on leave is "not in office".
export type TodayState = "office" | "leave" | null;
export type PersonRow = {
  email: string; name: string; role: "admin" | "member"; schedule: string; exempt: boolean;
  today: TodayState; markedAt: string | null; leaveType: string | null;
  // "MM-DD", entered by admins.
  birthday: string | null; showBirthday: boolean;
  // Marked as left: kept for the record, listed under the Left filter.
  left: boolean;
};

const onLeave = (away: AwayRow[], email: string, date: string) =>
  away.find((a) => a.email === email && a.type === "leave" && (a.status === "approved" || a.status === "pending") && date >= a.startDate && date <= a.endDate) ?? null;

// No counts or verdicts (no "3 of 8", no "Behind"): admins read the days themselves (teamMonth).
function personRow(e: EmployeeRow, todayRow: AttendanceRow | undefined, away: AwayRow[], today: string): PersonRow {
  const leave = onLeave(away, e.email, today);
  const mode = dayMode(todayRow) === "office" ? "office" : null;
  return {
    email: e.email, name: e.name || e.email.split("@")[0], role: e.role, exempt: e.officeExempt ?? false,
    schedule: e.officeExempt ? "Fully remote" : scheduleLabel(e.officeDays ?? []),
    today: mode ?? (leave ? "leave" : null), markedAt: mode ? todayRow?.checkInAt ?? null : null, leaveType: leave?.leaveType ?? null,
    birthday: e.birthday ?? null, showBirthday: e.showBirthday ?? false, left: !!e.leftOn,
  };
}

export async function adminOverview() {
  const today = todayIST();
  const month = today.slice(0, 7);
  const [employees, todayRows, away, tea] = await Promise.all([store.listEmployees(), store.listAttendance(today), store.listAway(500), store.listTeaAnswers(today)]);
  // Tea for the round that's on now (or the afternoon one once the day's rounds are done).
  const times = await snackTimes();
  const round = currentRound(new Date(), times) ?? { id: "pm" as const, at: times.pmAt, closesAt: times.pmClose, open: false, next: null };
  const teaGoing = tea.filter((t) => t.round === round.id && t.going);
  const people = employees
    .map((e) => personRow(e, todayRows.find((r) => r.email === e.email), away, today))
    .sort((a, b) => a.name.localeCompare(b.name));
  const names = new Map(employees.map((e) => [e.email, (e.name || e.email).split(" ")[0]]));
  return {
    // `total` is who an announcement should reach ("Seen by N of M"); people marked as left don't count.
    today, month, total: people.filter((p) => !p.left).length,
    tea: { round: round.id, at: round.at, closesAt: round.closesAt, count: teaGoing.length, names: teaGoing.map((t) => names.get(t.email) ?? t.email.split("@")[0]) },
    people,
  };
}
export type AdminOverview = Awaited<ReturnType<typeof adminOverview>>;

// One person's month for the side panel: which days were office, remote or leave.
export async function personMonth(email: string, month: string) {
  const { first, last } = monthBounds(month);
  const closed = await closedMap(first, last);
  const [rows, away, changes] = await Promise.all([store.listAttendanceRange(email, first, last), store.listAwayByEmail(email, 200), store.listAttendanceChanges(email, 10)]);
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const mode = dayMode(rows.find((r) => r.date === date)) === "office" ? ("office" as const) : null;
    return { date, working: isWorkingDay(date, closed), mode: mode ?? (onLeave(away, email, date) ? ("leave" as const) : null) };
  });
  return { month, days, changes };
}
export type PersonMonth = Awaited<ReturnType<typeof personMonth>>;

// The People grid: for everyone, which days of the month they were in the office or on leave.
// Columns are the month's working days plus closed days (shown as closed). Days after `today`
// stay blank. No counts or verdicts: admins read the days themselves.
export async function teamMonth(month: string, today = todayIST()) {
  const { first, last } = monthBounds(month);
  const closed = await closedMap(first, last);
  const [employees, away] = await Promise.all([store.listEmployees(), store.listAway(1000)]);
  const days: { date: string; closed: boolean; future: boolean }[] = [];
  for (let d = 1; d <= Number(last.slice(8)); d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const isClosed = closed.has(date);
    if (isClosed || isWorkingDay(date)) days.push({ date, closed: isClosed, future: date > today });
  }
  const rows = await Promise.all(employees.map((e) => store.listAttendanceRange(e.email, first, last)));
  const people = employees.map((e, i) => {
    const marks: Record<string, "office" | "leave"> = {};
    for (const { date, closed: shut, future } of days) {
      if (shut || future) continue;
      if (dayMode(rows[i].find((r) => r.date === date)) === "office") marks[date] = "office";
      else if (onLeave(away, e.email, date)) marks[date] = "leave";
    }
    return { email: e.email, name: e.name || e.email.split("@")[0], role: e.role, exempt: e.officeExempt ?? false, left: !!e.leftOn, marks };
  });
  return { month, today, days, people };
}
export type TeamMonth = Awaited<ReturnType<typeof teamMonth>>;
