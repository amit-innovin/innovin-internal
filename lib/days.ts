// What Home and Days show about office days, and the one write behind "I'm in the office".
// Server-only: reads the store. The rules themselves are pure and live in lib/office-days.ts.
import { officeCheck } from "./geo";
import { type Closed, holidaysFor, isWorkingDay, nonWorkingReason } from "./leave";
import { countOfficeDays, fixableFrom, monthBounds, officeDaysSummary, officeDayTarget, weekdayIndex } from "./office-days";
import { isPlanned, plannedOn } from "./plan";
import { attendanceLocation } from "./presence";
import { id, store } from "./store";
import { todayIST } from "./time";
import type { AttendanceRow, DayMode } from "./types";

// Rows from the old check-in flow have no declared mode; their position still classifies them.
export function dayMode(row: AttendanceRow | null | undefined): DayMode | null {
  if (!row) return null;
  const mode = attendanceLocation(row);
  return mode === "office" || mode === "remote" ? mode : null;
}

const firstName = (name: string, email: string) => (name.trim() || email.split("@")[0]).split(/\s+/)[0];

// Admin-set closures between two dates, as date → reason.
export async function closedMap(from: string, to: string): Promise<Closed> {
  return new Map((await store.listClosedDays(from, to)).map((r) => [r.date, r.reason]));
}

export async function daysView(email: string, month: string) {
  const today = todayIST();
  const { first, last } = monthBounds(month);
  const closed = await closedMap(first < today ? first : today, last > today ? last : today);
  const [me, rows, leave, todayRows, employees, overrides, todayOverride] = await Promise.all([
    store.getEmployee(email),
    store.listAttendanceRange(email, first, last),
    store.listAwayByEmail(email, 200),
    store.listAttendance(today),
    store.listEmployees(),
    store.listPlanOverrides(email, first, last),
    store.listPlanOverrides(email, today, today),
  ]);
  const officeDays = me?.officeDays ?? [];
  const holidays = holidaysFor(Number(month.slice(0, 4)));
  const from = fixableFrom(today);

  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const row = rows.find((r) => r.date === date);
    const away = leave.find((r) => r.type === "leave" && (r.status === "pending" || r.status === "approved") && date >= r.startDate && date <= r.endDate);
    const working = isWorkingDay(date, closed);
    const override = overrides.find((o) => o.date === date)?.planned;
    const planned = isPlanned({ date, today, officeDays, override, working, leave: !!away });
    return {
      date,
      mode: dayMode(row),
      // Added after the day itself, by the person or an admin.
      late: row?.source === "late" || row?.source === "admin",
      working,
      off: closed.has(date) ? null : holidays[date] ?? nonWorkingReason(date),
      // The reason, when an admin closed the office that day.
      closed: closed.get(date) ?? null,
      planned,
      // Planned on top of the usual weekdays.
      added: planned && !officeDays.includes(weekdayIndex(date)),
      leave: away ? away.status : null,
      fixable: date < today && date >= from,
    };
  });

  const target = officeDayTarget({ joinedOn: me?.joinedOn ?? null, officeExempt: me?.officeExempt ?? false }, month);
  const done = countOfficeDays(days.map((d) => ({ date: d.date, declaredMode: d.mode })));
  const mine = todayRows.find((r) => r.email === email);
  const byEmail = new Map(employees.map((e) => [e.email, e]));
  const inToday = todayRows.filter((r) => dayMode(r) === "office").map((r) => firstName(byEmail.get(r.email)?.name ?? "", r.email));

  return {
    today,
    month,
    fixableFrom: from,
    officeDays,
    summary: officeDaysSummary({ done, target, month, today, closed }),
    // Only an office check-in counts as marked: remote isn't a state any more, and old remote rows
    // read as not in the office.
    me: mine && dayMode(mine) === "office" ? { mode: "office" as const, source: mine.source ?? null, at: mine.checkInAt } : null,
    // Your usual days plus single dates planned in or out ahead of time.
    isOfficeDayToday: plannedOn({ date: today, officeDays, override: todayOverride[0]?.planned, working: isWorkingDay(today, closed), leave: false }),
    days,
    around: {
      inToday: { count: inToday.length, names: inToday.slice(0, 6) },
    },
  };
}
export type DaysView = Awaited<ReturnType<typeof daysView>>;

export type MarkResult =
  | { ok: true }
  | { ok: false; status: 403 | 409 | 422 | 428; code: "locked" | "future" | "closed" | "outside" | "location-needed"; error: string; distanceM?: number };

// One tap. Today: office is verified by location; remote is taken at its word.
// A past day inside the self-fix window is recorded as late, with no location check, and logged.
export async function markDay(input: { email: string; date: string; mode: DayMode | null; lat: number | null; lng: number | null; accuracyM: number | null }): Promise<MarkResult> {
  const today = todayIST();
  if (input.date > today) return { ok: false, status: 409, code: "future", error: "You can't mark a day that hasn't happened yet" };
  const now = new Date().toISOString();
  const before = dayMode(await store.getAttendance(input.email, input.date));
  // Nobody is in the office on a closed day, today or when fixing a past day.
  if (input.mode === "office" && (await closedMap(input.date, input.date)).has(input.date)) return { ok: false, status: 409, code: "closed", error: "The office is closed that day" };

  if (input.date === today) {
    if (input.mode === null) {
      await store.clearDay(input.email, today);
      return { ok: true };
    }
    let source: AttendanceRow["source"] = "self";
    let position = { lat: null as number | null, lng: null as number | null, accuracyM: null as number | null };
    if (input.mode === "office") {
      const check = officeCheck({ lat: input.lat, lng: input.lng });
      if (!check.ok) {
        return check.code === "outside"
          ? { ok: false, status: 422, code: "outside", distanceM: check.distanceM, error: "You don't look like you're at the office" }
          : { ok: false, status: 428, code: "location-needed", error: "Share your location once so we can check you're at the office" };
      }
      source = check.source;
      if (check.source === "location") position = { lat: input.lat, lng: input.lng, accuracyM: input.accuracyM };
    }
    await store.markDay({ id: id(), email: input.email, date: today, checkInAt: now, checkOutAt: null, ...position, declaredMode: input.mode, source });
    return { ok: true };
  }

  if (input.date < fixableFrom(today)) return { ok: false, status: 403, code: "locked", error: "You can fix your own last 7 days. Ask an admin to change an older day." };
  if (input.mode === null) await store.clearDay(input.email, input.date);
  else await store.markDay({ id: id(), email: input.email, date: input.date, checkInAt: now, checkOutAt: null, lat: null, lng: null, accuracyM: null, declaredMode: input.mode, source: "late" });
  if (before !== input.mode) await store.addAttendanceChange({ id: id(), email: input.email, date: input.date, from: before, to: input.mode, by: input.email, kind: "late", at: now });
  return { ok: true };
}
