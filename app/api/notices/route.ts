import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { NOTICE_REACTIONS, noticeBoard } from "@/lib/notices";
import { sendPush } from "@/lib/push";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";
import type { NoticeRow } from "@/lib/types";

const session = (req: NextRequest) => verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
const denied = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
const COLORS = ["yellow", "peach", "blue", "green", "purple"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const user = session(req);
  if (!user) return denied();
  return NextResponse.json(await noticeBoard(user.email));
}

// A Feed post by anyone: a quote or feedback note (optionally anonymous, optionally with a
// photo), a kudos for a colleague, or a poll.
export async function POST(req: NextRequest) {
  const user = session(req);
  if (!user) return denied();
  const limited = enforce([["noticeSender", user.email], ["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body) return badRequest();
  const kind = str(body.kind) as NoticeRow["kind"];
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const base: NoticeRow = { id: id(), kind, title: "", body: text, attribution: "", color: "purple", anonymous: false, authorEmail: user.email, authorName: user.name, createdAt: new Date().toISOString() };

  if (kind === "quote" || kind === "feedback") {
    if (!text || text.length > 2000) return badRequest("Choose a note type and write a note under 2,000 characters");
    if (!COLORS.includes(str(body.color)) || typeof body.anonymous !== "boolean") return badRequest("Choose a note color and author visibility");
    if (str(body.title).length > 120 || str(body.attribution).length > 120) return badRequest("Keep titles and attributions under 120 characters");
    const image = str(body.image);
    if (image && (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 700_000)) return badRequest("Photos must be a JPEG, PNG or WebP under about 500 KB");
    await store.addNotice({ ...base, title: str(body.title).trim(), attribution: str(body.attribution).trim(), color: str(body.color) as NoticeRow["color"], anonymous: body.anonymous, image: image || null,
      // The store drops these too; clear them here so the author never leaves this handler.
      ...(body.anonymous ? { authorEmail: null, authorName: null } : {}) });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (kind === "kudos") {
    const to = str(body.toEmail).trim().toLowerCase();
    if (!text || text.length > 500) return badRequest("Say what they did, in under 500 characters");
    if (to === user.email) return badRequest("Kudos are for someone else");
    const recipient = to ? await store.getEmployee(to) : null;
    if (!recipient) return badRequest("Choose who the kudos is for");
    await store.addNotice({ ...base, toEmail: recipient.email, toName: recipient.name || recipient.email });
    await sendPush({ title: `Kudos from ${user.name.split(" ")[0]}`, body: text.slice(0, 90), href: "/feed?filter=kudos", tag: `kudos-${base.id}` }, recipient.email).catch(() => {});
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (kind === "poll") {
    const question = str(body.title).trim();
    const options = Array.isArray(body.options) ? body.options.map((o) => str(o).trim()).filter(Boolean) : [];
    const closes = str(body.closesOn);
    const today = todayIST();
    if (!question || question.length > 140) return badRequest("Ask a question in under 140 characters");
    if (options.length < 2 || options.length > 6 || options.some((o) => o.length > 60) || new Set(options.map((o) => o.toLowerCase())).size !== options.length) return badRequest("Give 2 to 6 different options, each under 60 characters");
    if (!DATE.test(closes) || closes < today || closes > addDays(today, 30)) return badRequest("Choose a closing day within the next 30 days");
    // Voting stays open until the end of the closing day, office time.
    const closesAt = new Date(Date.parse(`${closes}T23:59:59+05:30`)).toISOString();
    await store.addNotice({ ...base, title: question, options, closesAt });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  return badRequest("Choose quote, feedback, kudos or poll");
}

// { id, emoji } toggles a reaction; { id, vote: number | null } votes in a poll.
export async function PATCH(req: NextRequest) {
  const user = session(req);
  if (!user) return denied();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body || !str(body.id)) return badRequest();
  if ("vote" in body) {
    const poll = (await store.listNotices(500)).find((n) => n.id === str(body.id) && n.kind === "poll");
    if (!poll) return NextResponse.json({ error: "Poll no longer exists" }, { status: 404 });
    if (poll.closesAt && Date.parse(poll.closesAt) < Date.now()) return NextResponse.json({ error: "This poll has closed" }, { status: 409 });
    const vote = body.vote;
    if (vote !== null && !(Number.isInteger(vote) && (vote as number) >= 0 && (vote as number) < (poll.options?.length ?? 0))) return badRequest("Choose one of the poll's options");
    await store.votePoll(poll.id, user.email, vote as number | null);
    return NextResponse.json({ ok: true });
  }
  if (!NOTICE_REACTIONS.includes(body.emoji as typeof NOTICE_REACTIONS[number])) return badRequest("Choose a supported reaction");
  const found = await store.toggleNoticeReaction(str(body.id), user.email, str(body.emoji));
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
