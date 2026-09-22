import { NextRequest, NextResponse } from "next/server";
import { allowedEmailDomains } from "@/lib/config";
import { EMAIL_COOKIE, longLivedCookie } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: today's count + the caller's own status (identified by their remembered email).
export async function GET(req: NextRequest) {
  const email = req.cookies.get(EMAIL_COOKIE)?.value ?? null;
  const rows = await store.listAttendance(todayIST());
  const mine = email ? rows.find((r) => r.email === email) : undefined;
  return NextResponse.json({
    count: rows.length,
    email,
    me: mine ? { checkInAt: mine.checkInAt, checkOutAt: mine.checkOutAt } : null,
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
  const existing = await store.getAttendance(email, date);

  let row;
  if (action === "out") {
    if (!existing) return NextResponse.json({ error: "Check in first" }, { status: 404 });
    // Idempotent: a repeated check-out keeps the original time.
    row = existing.checkOutAt ? existing : await store.checkOut(email, date, now);
  } else {
    row = existing ?? (await store.checkIn({ id: id(), email, date, checkInAt: now, checkOutAt: null }));
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
