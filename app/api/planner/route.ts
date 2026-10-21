import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";
import { PLANNER_LABELS, validPlannerDate } from "@/lib/workspace-model";
import type { PlannerKind } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!validPlannerDate(from) || !validPlannerDate(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) return badRequest("Choose a date range within one year");
  return NextResponse.json(await store.listPlannerDays(user.email, from, to));
}

export async function POST(req: NextRequest) {
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const date = str(body?.date), kind = str(body?.kind);
  if (!validPlannerDate(date)) return badRequest("Choose a valid day");
  if (kind === "clear") await store.deletePlannerDay(user.email, date);
  else if (Object.hasOwn(PLANNER_LABELS, kind)) await store.setPlannerDay({ email: user.email, date, kind: kind as PlannerKind });
  else return badRequest("Choose a valid status");
  return NextResponse.json({ ok: true });
}
