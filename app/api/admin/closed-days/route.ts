import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/lib/admin";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";
import { todayIST, validDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
async function adminActor() {
  const actor = await currentActor();
  return actor?.role === "admin" ? actor : null;
}

// Dates the office is closed. They're greyed out on everyone's Days calendar, can't be planned or
// checked in on, and cost no leave. Public holidays come from the company calendar instead.
export async function GET(req: NextRequest) {
  if (!(await adminActor())) return unauthorized();
  const today = todayIST();
  const from = req.nextUrl.searchParams.get("from") ?? today;
  const to = req.nextUrl.searchParams.get("to") ?? `${Number(today.slice(0, 4)) + 1}-12-31`;
  if (!validDate(from) || !validDate(to)) return badRequest("Invalid dates");
  return NextResponse.json(await store.listClosedDays(from, to));
}

export async function POST(req: NextRequest) {
  const actor = await adminActor();
  if (!actor) return unauthorized();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const date = str(body?.date), reason = str(body?.reason).trim();
  if (!validDate(date) || !reason || reason.length > 120) return badRequest("Pick a date and say why the office is closed");
  if (date < todayIST()) return NextResponse.json({ error: "That day has already passed" }, { status: 409 });
  const added = await store.addClosedDay({ date, reason, createdBy: actor.name || actor.email, createdAt: new Date().toISOString() });
  if (!added) return NextResponse.json({ error: "Already closed" }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await adminActor())) return unauthorized();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const date = str(body?.date);
  if (!validDate(date)) return badRequest("Invalid date");
  if (!(await store.removeClosedDay(date))) return NextResponse.json({ error: "That day isn't closed" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
