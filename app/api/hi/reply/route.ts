import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";

// Answer an invite you received: { id, reply: "yes" | "no" }. Once, and only for invites.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const hiId = str(body?.id), reply = body?.reply;
  if (!hiId || (reply !== "yes" && reply !== "no")) return badRequest("Yes or not today?");
  if (!(await store.setHiReply(hiId, session.email, reply))) return NextResponse.json({ error: "You can't answer that one", code: "cannot-reply" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
