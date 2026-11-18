import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { HI_KINDS, HI_PER_DAY, INVITES, validHiTime } from "@/lib/hi";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { sendPush } from "@/lib/push";
import { inOfficeToday } from "@/lib/snack-times";
import { istClock } from "@/lib/snacks-rules";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";
import type { HiKind } from "@/lib/types";

// Send a wave or an invite: { to, kind, time? }. Both people must have Say hi on and be checked
// in at the office today; up to 3 a day each. The push is generic; the message is in the app.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const to = str(body?.to).trim().toLowerCase();
  const kind = str(body?.kind) as HiKind;
  if (!to || !HI_KINDS.includes(kind)) return badRequest("Pick who and what to send");
  if (to === session.email.toLowerCase()) return badRequest("Say hi is for someone else");
  const isInvite = INVITES.includes(kind);
  if (isInvite && !validHiTime(body?.time)) return badRequest("Pick a time between 9:00 and 19:00");
  // A picked time must still be ahead today (office time).
  if (isInvite && typeof body?.time === "string" && body.time.includes(":") && body.time <= istClock(new Date())) return badRequest("Pick a time later today");
  const date = todayIST();
  const [me, them] = await Promise.all([store.getEmployee(session.email), store.getEmployee(to)]);
  if (!me?.sayHi || !them?.sayHi) return NextResponse.json({ error: "Say hi only works between people who turned it on", code: "opted-out" }, { status: 403 });
  if (!(await inOfficeToday(session.email, date)) || !(await inOfficeToday(to, date))) return NextResponse.json({ error: "Say hi is for people in the office today", code: "not-in-office" }, { status: 403 });
  const row = await store.addHi({ id: id(), date, from: session.email, to, kind, atTime: isInvite ? (body!.time as string) : null, reply: null, createdAt: new Date().toISOString() }, HI_PER_DAY);
  if (!row) {
    const already = (await store.listHiFrom(date, session.email)).some((h) => h.to === to);
    return NextResponse.json(already ? { error: "You already said hi to them today", code: "already" } : { error: "You've sent 3 today", code: "limit" }, { status: 409 });
  }
  await sendPush({ title: "Say hi", body: "Someone said hi.", href: "/notifications", tag: `hi-${row.id}` }, to).catch(() => {});
  return NextResponse.json(row);
}
