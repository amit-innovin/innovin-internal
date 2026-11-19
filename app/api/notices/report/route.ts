import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";
import { keyedRef } from "@/lib/submitter";

// "Report this post": tells admins a Feed post may be inappropriate. Kept against a keyed hash of
// the reporter, so admins only ever see how many people reported it, never who.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const id = str(body?.id);
  if (!id) return badRequest("Which post?");
  const notice = (await store.listNotices(200)).find((n) => n.id === id);
  if (!notice) return NextResponse.json({ error: "That post is gone" }, { status: 404 });
  if (notice.authorEmail?.toLowerCase() === session.email.toLowerCase()) return badRequest("That's your own post");
  if (!(await store.addNoticeReport(id, keyedRef("report", session.email)))) return NextResponse.json({ error: "You already reported this post", code: "already" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
