import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { PING_MAX_LEN } from "@/lib/pings";
import { sendPush } from "@/lib/push";
import { id, store } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ping = Awaited<ReturnType<typeof store.listPingsFor>>[number];

const threadOf = (me: string, pings: Ping[]) => {
  const threads = new Map<string, { email: string; unread: number; last: Ping }>();
  for (const p of pings) {
    const peer = p.fromEmail === me ? p.toEmail : p.fromEmail;
    const t = threads.get(peer) ?? { email: peer, unread: 0, last: p };
    if (p.toEmail === me && !p.readAt) t.unread++;
    threads.set(peer, t);
  }
  return [...threads.values()];
};

// Pings — one-line messages between people, kept for 24h and then gone. Everything here
// needs a verified Google identity: an unsigned device has nobody to be "from".
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ signedIn: false, threads: [] });

  const pings = await store.listPingsFor(session.email, 200);
  const peer = req.nextUrl.searchParams.get("with");

  if (peer) {
    const person = await store.getEmployee(peer);
    const messages = pings
      .filter((p) => p.fromEmail === peer || p.toEmail === peer)
      .reverse()
      .map((p) => ({ id: p.id, body: p.body, at: p.createdAt, mine: p.fromEmail === session.email }));
    return NextResponse.json({
      signedIn: true,
      person: person
        ? { email: person.email, name: person.name, picture: person.picture }
        : { email: peer, name: peer, picture: "" },
      messages,
    });
  }

  const employees = await store.listEmployees();
  const names = new Map(employees.map((e) => [e.email, e]));
  const threads = threadOf(session.email, pings).map((t) => {
    const e = names.get(t.email);
    return {
      email: t.email,
      name: e?.name || t.email,
      picture: e?.picture ?? "",
      unread: t.unread,
      last: { body: t.last.body, at: t.last.createdAt, mine: t.last.fromEmail === session.email },
    };
  });
  return NextResponse.json({ signedIn: true, me: session.email, threads });
}

export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in to ping someone" }, { status: 401 });
  const limited = enforce([
    ["writeIp", clientIp(req)],
    ["pingSender", session.email],
  ]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!to || !text || text.length > PING_MAX_LEN) return badRequest(`Keep it under ${PING_MAX_LEN} characters`);
  if (to === session.email) return badRequest("That's you");

  const target = await store.getEmployee(to);
  if (!target) return badRequest("They haven't signed in yet");

  const row = await store.addPing({
    id: id(),
    fromEmail: session.email,
    toEmail: to,
    body: text,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
  sendPush(
    { title: session.name || session.email, body: text, href: `/people?ping=${encodeURIComponent(session.email)}`, tag: `ping-${session.email}` },
    to,
  ).catch(() => {});
  return NextResponse.json({ ok: true, ping: { id: row.id, body: row.body, at: row.createdAt } });
}

// Marks a thread read — opening a conversation acknowledges what it shows.
export async function PATCH(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = await readJSON(req);
  if (!body || typeof body.from !== "string") return badRequest();
  await store.markPingsRead(session.email, body.from.trim().toLowerCase());
  return NextResponse.json({ ok: true });
}
