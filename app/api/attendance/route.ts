import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { allowedEmailDomains } from "@/lib/config";
import { EMAIL_COOKIE, longLivedCookie } from "@/lib/cookies";
import { locationTag, officeLocation, onOfficeNetwork } from "@/lib/geo";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { holidaysFor, isWorkingDay, nonWorkingReason, workingDaysInMonth } from "@/lib/leave";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Public: today's headcount + the caller's own status (identified by their remembered email).
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
  const day = email ? await store.getAttendance(email, date) : null;
  return NextResponse.json({
    count: new Set(rows.map((r) => r.email)).size,
    email,
    // Lets the client do confident auto check-in: on office Wi-Fi (IP match) or inside the
    // geofence. The office's own coordinates aren't secret to the people who work there.
    onOfficeNetwork: onOfficeNetwork(clientIp(req)),
    office: officeLocation(),
    me: day
      ? {
          checkedIn: !day.checkOutAt,
          checkInAt: day.checkInAt,
          checkOutAt: day.checkOutAt,
          location: locationTag(day.lat, day.lng),
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
    const day = rows.find((r) => r.date === date);
    const away = leave.find((r) => (r.status === "pending" || r.status === "approved") && date >= r.startDate && date <= r.endDate);
    return {
      date,
      // Raw coordinates never leave the server — only the office/remote classification.
      present: !!day,
      open: !!day && !day.checkOutAt,
      location: day ? locationTag(day.lat, day.lng) : null,
      checkInAt: day?.checkInAt ?? null,
      checkOutAt: day?.checkOutAt ?? null,
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
  let lat = num(body.lat);
  let lng = num(body.lng);
  let accuracyM = num(body.accuracyM);
  if ((lat === null) !== (lng === null)) return badRequest("Invalid coordinates");
  if (lat != null && (Math.abs(lat) > 90 || Math.abs(lng!) > 180 || (accuracyM != null && accuracyM < 0))) {
    return badRequest("Invalid coordinates");
  }
  // On office Wi-Fi the network itself is the proof — no GPS needed. We store the office's
  // own coordinates so the session classifies as "in office" everywhere downstream.
  if (lat === null && onOfficeNetwork(clientIp(req))) {
    const office = officeLocation();
    if (office) {
      lat = office.lat;
      lng = office.lng;
      accuracyM = office.radiusM;
    }
  }

  const date = todayIST();
  const now = new Date().toISOString();
  const day = await store.getAttendance(email, date);

  let row;
  if (action === "out") {
    if (!day || day.checkOutAt) return NextResponse.json({ error: "Check in first" }, { status: 404 });
    row = await store.checkOut(email, date, now);
  } else {
    // Idempotent while checked in; after checkout the same day-row reopens.
    row = day && !day.checkOutAt ? day : await store.checkIn({ id: id(), email, date, checkInAt: now, checkOutAt: null, lat, lng, accuracyM });
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
