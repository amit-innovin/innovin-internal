import { NextRequest, NextResponse } from "next/server";
import { allowedEmailDomains } from "@/lib/config";
import { EMAIL_COOKIE, longLivedCookie } from "@/lib/cookies";
import { totalMinutes } from "@/lib/format";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: today's headcount + the caller's own sessions (identified by their remembered email).
export async function GET(req: NextRequest) {
  const email = req.cookies.get(EMAIL_COOKIE)?.value ?? null;
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
          totalMinutes: totalMinutes(sessions),
          sessions: sessions.map(({ checkInAt, checkOutAt }) => ({ checkInAt, checkOutAt })),
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  const email = str(body.email).trim().toLowerCase().slice(0, 254);
  const action = body.action;

  if (!EMAIL.test(email)) return badRequest("Enter a valid email");
  if (!allowedEmailDomains().includes(email.split("@")[1])) {
    return NextResponse.json({ error: "Use your Innovin email" }, { status: 403 });
  }
  if (action !== "in" && action !== "out") return badRequest("Invalid attendance action");

  const date = todayIST();
  const now = new Date().toISOString();
  const open = await store.getAttendance(email, date);

  let row;
  if (action === "out") {
    if (!open) return NextResponse.json({ error: "Check in first" }, { status: 404 });
    row = await store.checkOut(email, date, now);
  } else {
    // Idempotent while a session is open; after checkout a new session starts.
    row = open ?? (await store.checkIn({ id: id(), email, date, checkInAt: now, checkOutAt: null }));
  }

  const res = NextResponse.json(row);
  res.cookies.set(EMAIL_COOKIE, email, longLivedCookie);
  return res;
}

// "Not you?" — forget the remembered email on this device.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(EMAIL_COOKIE, "", { expires: new Date(0), path: "/" });
  return res;
}
