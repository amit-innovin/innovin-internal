import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { NOTICE_REACTIONS, noticeBoard } from "@/lib/notices";
import { id, store } from "@/lib/store";
import type { NoticeRow } from "@/lib/types";

const session = (req: NextRequest) => verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
const denied = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
export async function GET(req: NextRequest) {
  const user = session(req);
  if (!user) return denied();
  return NextResponse.json(await noticeBoard(user.email));
}
export async function POST(req: NextRequest) {
  const user = session(req);
  if (!user) return denied();
  const limited = enforce([["noticeSender", user.email], ["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body || !["quote", "feedback"].includes(str(body.kind)) || typeof body.body !== "string" || !body.body.trim() || body.body.length > 2000) return badRequest("Choose a note type and write a note under 2,000 characters");
  if (!["yellow", "peach", "blue", "green", "purple"].includes(str(body.color)) || typeof body.anonymous !== "boolean") return badRequest("Choose a note color and author visibility");
  if (str(body.title).length > 120 || str(body.attribution).length > 120) return badRequest("Keep titles and attributions under 120 characters");
  const anonymous = body.anonymous;
  await store.addNotice({ id: id(), kind: body.kind as NoticeRow["kind"], title: str(body.title).trim(), body: body.body.trim(), attribution: str(body.attribution).trim(), color: body.color as NoticeRow["color"], anonymous, authorEmail: anonymous ? null : user.email, authorName: anonymous ? null : user.name, createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true }, { status: 201 });
}
export async function PATCH(req: NextRequest) {
  const user = session(req);
  if (!user) return denied();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!str(body?.id) || !NOTICE_REACTIONS.includes(body?.emoji as typeof NOTICE_REACTIONS[number])) return badRequest("Choose a supported reaction");
  const found = await store.toggleNoticeReaction(str(body?.id), user.email, str(body?.emoji));
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Note no longer exists" }, { status: 404 });
}
export async function DELETE(req: NextRequest) {
  if (!session(req)) return denied();
  if (!(await isAdmin())) return NextResponse.json({ error: "Only administrators can remove board posts" }, { status: 403 });
  const body = await readJSON(req);
  if (!str(body?.id)) return badRequest();
  const deleted = await store.deleteNotice(str(body?.id));
  return NextResponse.json({ ok: deleted }, { status: deleted ? 200 : 404 });
}
