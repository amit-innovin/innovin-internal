import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { store } from "@/lib/store";

// Moves the caller's Feed watermark forward to a post they've now seen: { at }. Never backwards,
// and never past now.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const at = typeof body?.at === "string" ? Date.parse(body.at) : NaN;
  if (!Number.isFinite(at)) return badRequest("Send the time of the last post you saw");
  const seenAt = new Date(Math.min(at, Date.now())).toISOString();
  await store.setFeedSeenAt(session.email, seenAt);
  return NextResponse.json({ seenAt });
}
