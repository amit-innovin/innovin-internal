import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { allowedEmailDomains } from "@/lib/config";
import { EMAIL_COOKIE, longLivedCookie } from "@/lib/cookies";
import { totalMinutes } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Public: today's headcount + the caller's own sessions (identified by their remembered email).
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const email = session?.email ?? req.cookies.get(EMAIL_COOKIE)?.value ?? null;
  const date = todayIST();
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
