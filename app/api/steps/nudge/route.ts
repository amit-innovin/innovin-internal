import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { sendPush } from "@/lib/push";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

// One friendly "time for a walk?" to someone in the league, at most once a day each, and only
// between people who both joined.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const to = str(body?.email).trim().toLowerCase();
  if (!to) return badRequest("Who?");
  if (to === session.email) return badRequest("Nudges are for someone else");
  const [me, them] = await Promise.all([store.getEmployee(session.email), store.getEmployee(to)]);
  if (!me?.stepsLeague || !them?.stepsLeague) return NextResponse.json({ error: "Nudges are only between people in the step league", code: "not-in-league" }, { status: 403 });
  if (!(await store.addNudge(todayIST(), session.email, to))) return NextResponse.json({ error: "You already nudged them today", code: "already" }, { status: 409 });
  const first = (me.name || me.email).split(/\s+/)[0];
  await sendPush({ title: "Time for a walk?", body: `${first} nudged you.`, href: "/steps", tag: `nudge-${todayIST()}-${session.email}` }, to).catch(() => {});
  return NextResponse.json({ ok: true });
}
