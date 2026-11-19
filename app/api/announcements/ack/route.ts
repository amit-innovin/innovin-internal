import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";

// "Got it" on an important announcement: { id }. Stored per person so it never shows again.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const id = str(body?.id);
  if (!id || id.length > 100) return badRequest("Which announcement?");
  if (!(await store.getAnnouncement(id))) return NextResponse.json({ error: "That announcement is gone" }, { status: 404 });
  await store.ackAnnouncement(id, session.email);
  return NextResponse.json({ ok: true });
}
