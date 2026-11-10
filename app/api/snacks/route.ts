import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { accountRef } from "@/lib/submitter";

export const dynamic = "force-dynamic";
const signIn = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });

// Votes are kept against a keyed hash of the voter, never the email: one vote each, and nobody,
// admins included, can see who wants what. Suggestions store no author at all.
const voterRef = (email: string) => accountRef(`snack:${email}`);

async function view(email: string) {
  const [items, votes, admin] = await Promise.all([store.listSnacks(), store.listSnackVotes(), isAdmin()]);
  const me = voterRef(email);
  const row = (i: (typeof items)[number]) => ({ id: i.id, name: i.name, note: i.note, orderedAt: i.orderedAt, votes: votes.filter((v) => v.itemId === i.id).length, mine: votes.some((v) => v.itemId === i.id && v.voterRef === me) });
  const byVotes = (a: { votes: number; name: string }, b: { votes: number; name: string }) => b.votes - a.votes || a.name.localeCompare(b.name);
  return {
    shelf: items.filter((i) => i.status === "shelf").map(row).sort(byVotes),
    suggestions: items.filter((i) => i.status === "suggested").map(row).sort(byVotes),
    canManage: admin,
  };
}

export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  return NextResponse.json(await view(session.email));
}

// { name } suggests a snack (or +1s it if someone already suggested it). Admins can pass
// { name, shelf: true } to put it straight on the shelf.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const name = str(body?.name).trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) return badRequest("Name the snack in under 60 characters");
  const toShelf = body?.shelf === true;
  if (toShelf && !(await isAdmin())) return NextResponse.json({ error: "Only admins can stock the shelf" }, { status: 403 });
  const existing = (await store.listSnacks()).find((s) => s.status !== "dismissed" && s.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (toShelf && existing.status !== "shelf") await store.setSnackStatus(existing.id, "shelf", null);
    else if (!(await store.listSnackVotes()).some((v) => v.itemId === existing.id && v.voterRef === voterRef(session.email))) await store.toggleSnackVote(existing.id, voterRef(session.email));
  } else {
    const item = await store.addSnack({ id: id(), name, note: str(body?.note).trim().slice(0, 60), status: toShelf ? "shelf" : "suggested", orderedAt: null, createdAt: new Date().toISOString() });
    if (!toShelf) await store.toggleSnackVote(item.id, voterRef(session.email));
  }
  return NextResponse.json(await view(session.email), { status: 201 });
}

// { id, action: "vote" } toggles your "I'd like this". Admins: "add" (suggestion → shelf),
// "dismiss", "ordered" (bought: starts the count again), "remove" (off the shelf).
export async function PATCH(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const itemId = str(body?.id), action = str(body?.action);
  if (!itemId) return badRequest();
  const item = await store.getSnack(itemId);
  if (!item || item.status === "dismissed") return NextResponse.json({ error: "That snack is no longer listed" }, { status: 404 });
  if (action === "vote") {
    await store.toggleSnackVote(itemId, voterRef(session.email));
    return NextResponse.json(await view(session.email));
  }
  if (!["add", "dismiss", "ordered", "remove"].includes(action)) return badRequest("Unknown action");
  if (!(await isAdmin())) return NextResponse.json({ error: "Only admins can manage the snack shelf" }, { status: 403 });
  if (action === "add") await store.setSnackStatus(itemId, "shelf", item.orderedAt);
  if (action === "dismiss" || action === "remove") await store.setSnackStatus(itemId, "dismissed", item.orderedAt);
  if (action === "ordered") { await store.setSnackStatus(itemId, item.status, new Date().toISOString()); await store.clearSnackVotes(itemId); }
  return NextResponse.json(await view(session.email));
}
