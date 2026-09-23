import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { allowedEmailDomains } from "@/lib/config";
import { EMAIL_COOKIE, longLivedCookie } from "@/lib/cookies";
import { totalMinutes } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { holidaysFor, isWorkingDay, nonWorkingReason, workingDaysInMonth } from "@/lib/leave";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Public: today's headcount + the caller's own sessions (identified by their remembered email).
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const email = session?.email ?? req.cookies.get(EMAIL_COOKIE)?.value ?? null;
  const date = todayIST();

  // Calendar: one month of the caller's own days. Works without a Google sign-in, since
  // attendance is keyed by the remembered email — leave days need a verified identity though.
  const month = req.nextUrl.searchParams.get("month");
  if (month !== null) {
    if (!MONTH.test(month)) return badRequest("Invalid month");
    return NextResponse.json(await monthView(month, email, !!session, date));
  }
  const rows = await store.listAttendance(date);
  const sessions = email ? await store.listAttendanceByEmail(email, date) : [];
  const open = sessions.find((s) => !s.checkOutAt);
  return NextResponse.json({
    count: new Set(rows.map((r) => r.email)).size,
    email,
    me: sessions.length
      ? {
          checkedIn: !!open,
          currentInAt: open?.checkInAt ?? null,
          location: locationTag(open?.lat, open?.lng),
          totalMinutes: totalMinutes(sessions),
          sessions: sessions.map(({ checkInAt, checkOutAt, lat, lng }) => ({
            checkInAt,
            checkOutAt,
            location: locationTag(lat, lng),
          })),
        }
      : null,
  });
}

// A day in the calendar: what was worked, and why it was off if nothing was.
async function monthView(month: string, email: string | null, verified: boolean, today: string) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  // Leave is only trustworthy for a verified identity — an unsigned device could type any email.
  const [rows, leave] = await Promise.all([
    email ? store.listAttendanceRange(email, from, to) : Promise.resolve([]),
    verified && email ? store.listAwayByEmail(email, 200) : Promise.resolve([]),
  ]);

  const holidays = holidaysFor(year);
  const days = Array.from({ length: lastDay }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const sessions = rows.filter((r) => r.date === date);
    const away = leave.find((r) => r.status !== "rejected" && date >= r.startDate && date <= r.endDate);
    return {
      date,
      minutes: sessions.length ? totalMinutes(sessions) : 0,
      open: sessions.some((s) => !s.checkOutAt),
      // Raw coordinates never leave the server — only the office/remote classification.
      sessions: sessions.map(({ checkInAt, checkOutAt, lat, lng }) => ({
        checkInAt,
        checkOutAt,
        location: locationTag(lat, lng),
      })),
      holiday: holidays[date] ?? null,
      working: isWorkingDay(date),
      off: nonWorkingReason(date),
      leave: away ? { type: away.leaveType, kind: away.type, status: away.status, halfDay: away.halfDay } : null,
    };
  });

  return {
    month,
    today,
    email,
    verified,
    workingDays: workingDaysInMonth(year, mon),
    days,
    // Relative to today, not the month being browsed — these stay useful while paging back.
    upcomingHolidays: Object.entries(holidaysFor(Number(today.slice(0, 4))))
      .filter(([d]) => d >= today)
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function POST(req: NextRequest) {
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  // A verified Google sign-in wins over whatever email the client sent — attendance can't be
  // marked for someone else on a signed-in device.
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const email = session?.email ?? str(body.email).trim().toLowerCase().slice(0, 254);
  const action = body.action;

  if (!EMAIL.test(email)) return badRequest("Enter a valid email");
  if (!allowedEmailDomains().includes(email.split("@")[1])) {
    return NextResponse.json({ error: "Use your Innovin email" }, { status: 403 });
  }
  if (action !== "in" && action !== "out") return badRequest("Invalid attendance action");

  // Optional browser geolocation — present on check-in when the employee shared it.
  const lat = num(body.lat);
  const lng = num(body.lng);
  const accuracyM = num(body.accuracyM);
  if ((lat === null) !== (lng === null)) return badRequest("Invalid coordinates");
  if (lat != null && (Math.abs(lat) > 90 || Math.abs(lng!) > 180 || (accuracyM != null && accuracyM < 0))) {
    return badRequest("Invalid coordinates");
  }

  const date = todayIST();
  const now = new Date().toISOString();
  const open = await store.getAttendance(email, date);

  let row;
  if (action === "out") {
    if (!open) return NextResponse.json({ error: "Check in first" }, { status: 404 });
    row = await store.checkOut(email, date, now);
  } else {
    // Idempotent while a session is open; after checkout a new session starts.
    row = open ?? (await store.checkIn({ id: id(), email, date, checkInAt: now, checkOutAt: null, lat, lng, accuracyM }));
  }

  const res = NextResponse.json(row);
  res.cookies.set(EMAIL_COOKIE, email, longLivedCookie);
  return res;
}

// "Not you?" — forget the remembered email on this device. Also ends a Google sign-in so a
// shared device can't keep marking attendance as the signed-in person.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(EMAIL_COOKIE, "", { expires: new Date(0), path: "/" });
  res.cookies.delete(USER_COOKIE);
  return res;
}
