import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/lib/admin";
import { closedMap, dayMode } from "@/lib/days";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { todayIST, validDate } from "@/lib/time";

// An admin fixes anyone's day, any day up to today. No location check; every change is
// logged with the admin's email ("Every change you make is logged with your name").
export async function POST(req: NextRequest) {
  const actor = await currentActor();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const email = str(body?.email).trim().toLowerCase(), date = str(body?.date);
  // Remote isn't a mark: "none" records not in office.
  const mode = body?.mode === "office" ? "office" : body?.mode === "none" ? null : undefined;
  if (!email || !validDate(date) || mode === undefined) return badRequest("Pick a person, a day and office or not in office");
  if (date > todayIST()) return NextResponse.json({ error: "You can't mark a day that hasn't happened yet" }, { status: 409 });
  if (!(await store.getEmployee(email))) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  // Same rule as members: nobody is in the office on a day it was closed.
  if (mode === "office" && (await closedMap(date, date)).has(date)) return NextResponse.json({ error: "The office is closed that day", code: "closed" }, { status: 409 });
  const now = new Date().toISOString();
  const before = dayMode(await store.getAttendance(email, date));
  if (mode === null) await store.clearDay(email, date);
  else await store.markDay({ id: id(), email, date, checkInAt: now, checkOutAt: null, lat: null, lng: null, accuracyM: null, declaredMode: mode, source: "admin" });
  if (before !== mode) await store.addAttendanceChange({ id: id(), email, date, from: before, to: mode, by: actor.email, kind: "admin", at: now });
  return NextResponse.json({ ok: true });
}
