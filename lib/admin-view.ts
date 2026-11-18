// What the admin area shows: today across the office, and everyone's office days this month.
// Server-only: reads the store. Office-day rules stay in lib/office-days.ts.
import { closedMap, dayMode } from "./days";
import { type Closed, isWorkingDay } from "./leave";
import { countOfficeDays, monthBounds, officeDaysSummary, officeDayTarget, scheduleLabel, type OfficeDayStatus } from "./office-days";
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
  done: number; target: number | null; status: OfficeDayStatus;
  // "MM-DD", entered by admins.
  birthday: string | null; showBirthday: boolean;
  // Marked as left: kept for the record, never counted as behind.
  left: boolean;
};

const onLeave = (away: AwayRow[], email: string, date: string) =>
  away.find((a) => a.email === email && a.type === "leave" && (a.status === "approved" || a.status === "pending") && date >= a.startDate && date <= a.endDate) ?? null;

const STATUS_ORDER: Record<OfficeDayStatus, number> = { behind: 0, "on-track": 1, done: 2, exempt: 3 };

function personRow(e: EmployeeRow, monthRows: AttendanceRow[], todayRow: AttendanceRow | undefined, away: AwayRow[], month: string, today: string, closed: Closed): PersonRow {
  const target = officeDayTarget({ joinedOn: e.joinedOn, officeExempt: e.officeExempt ?? false }, month);
  const done = countOfficeDays(monthRows.map((r) => ({ date: r.date, declaredMode: dayMode(r) })));
  const leave = onLeave(away, e.email, today);
  const mode = dayMode(todayRow) === "office" ? "office" : null;
  return {
    email: e.email, name: e.name || e.email.split("@")[0], role: e.role, exempt: e.officeExempt ?? false,
    schedule: e.officeExempt ? "Fully remote" : scheduleLabel(e.officeDays ?? []),
    today: mode ?? (leave ? "leave" : null), markedAt: mode ? todayRow?.checkInAt ?? null : null, leaveType: leave?.leaveType ?? null,
    done, target, status: e.leftOn ? "exempt" : officeDaysSummary({ done, target, month, today, closed }).status,
    birthday: e.birthday ?? null, showBirthday: e.showBirthday ?? false, left: !!e.leftOn,
  };
}

export async function adminOverview() {
  const today = todayIST();
  const month = today.slice(0, 7);
  const { first, last } = monthBounds(month);
  const closed = await closedMap(first, last);
  const [employees, todayRows, away, tea] = await Promise.all([store.listEmployees(), store.listAttendance(today), store.listAway(500), store.listTeaAnswers(today)]);
  // Tea for the round that's on now (or the afternoon one once the day's rounds are done).
  const times = await snackTimes();
  const round = currentRound(new Date(), times) ?? { id: "pm" as const, at: times.pmAt, closesAt: times.pmClose, open: false, next: null };
  const teaGoing = tea.filter((t) => t.round === round.id && t.going);
  const monthRows = await Promise.all(employees.map((e) => store.listAttendanceRange(e.email, first, last)));
  const people = employees
    .map((e, i) => personRow(e, monthRows[i], todayRows.find((r) => r.email === e.email), away, month, today, closed))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.done - b.done || a.name.localeCompare(b.name));

  const count = (s: TodayState) => people.filter((p) => p.today === s).length;
  const names = new Map(employees.map((e) => [e.email, (e.name || e.email).split(" ")[0]]));
  let workingLeft = 0;
  for (let d = Number(today.slice(8)); d <= Number(last.slice(8)); d += 1) if (isWorkingDay(`${month}-${String(d).padStart(2, "0")}`, closed)) workingLeft += 1;
  return {
    today, month, total: people.length, admins: people.filter((p) => p.role === "admin").length, workingLeft,
    counts: { office: count("office"), leave: count("leave"), notIn: count(null) },
    status: { behind: people.filter((p) => p.status === "behind").length, onTrack: people.filter((p) => p.status === "on-track").length, done: people.filter((p) => p.status === "done").length, exempt: people.filter((p) => p.status === "exempt").length },
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
