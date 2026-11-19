import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { closedMap, daysView } from "@/lib/days";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { isWorkingDay } from "@/lib/leave";
import { weekdayIndex } from "@/lib/office-days";
import { addMonths, PLAN_MONTHS_AHEAD } from "@/lib/plan";
import { store } from "@/lib/store";
import { todayIST, validDate } from "@/lib/time";

export const dynamic = "force-dynamic";

// Plans one future day in or out on top of the caller's usual weekdays: { date, planned }.
// Only differences from the usual days are stored, so changing the weekly days later still works.
export async function PATCH(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const date = body?.date;
  if (typeof date !== "string" || !validDate(date) || typeof body?.planned !== "boolean") return badRequest("Send a date and whether you plan to come in");

  const today = todayIST();
  const [me, closed, away] = await Promise.all([store.getEmployee(session.email), closedMap(date, date), store.listAwayByEmail(session.email, 200)]);
  if (!me) return NextResponse.json({ error: "Sign in again to plan your days" }, { status: 404 });
  const onLeave = away.some((r) => r.type === "leave" && (r.status === "pending" || r.status === "approved") && date >= r.startDate && date <= r.endDate);
  if (date <= today || date.slice(0, 7) > addMonths(today.slice(0, 7), PLAN_MONTHS_AHEAD) || !isWorkingDay(date, closed) || onLeave) {
    return NextResponse.json({ error: "You can't plan that day", code: "not-plannable" }, { status: 409 });
  }
  const usual = (me.officeDays ?? []).includes(weekdayIndex(date));
  await store.setPlanOverride(session.email, date, body.planned === usual ? null : body.planned);
  return NextResponse.json(await daysView(session.email, date.slice(0, 7)));
}
