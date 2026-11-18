import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { store } from "@/lib/store";

// Turn Say hi on or off: { on }. Off means nobody can wave at you and you can't wave.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (typeof body?.on !== "boolean") return badRequest("On or off?");
  if (!(await store.setSayHi(session.email, body.on))) return NextResponse.json({ error: "Sign in again" }, { status: 404 });
  return NextResponse.json({ sayHi: body.on });
}
