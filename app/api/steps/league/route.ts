import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { store } from "@/lib/store";

// Join or leave the step league: { on }. Only people who joined are listed or can be nudged.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (typeof body?.on !== "boolean") return badRequest("Join or leave?");
  if (!(await store.setStepsLeague(session.email, body.on))) return NextResponse.json({ error: "Sign in again" }, { status: 404 });
  return NextResponse.json({ inLeague: body.on });
}
