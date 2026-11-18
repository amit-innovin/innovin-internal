import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { inOfficeToday, snackTimes } from "@/lib/snack-times";
import { pickCounts, pickOpen } from "@/lib/snacks-rules";
import { accountRef, keyedRef } from "@/lib/submitter";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";
const signIn = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });

// Votes are kept against a keyed hash of the voter, never the email: one vote each, and nobody,
// admins included, can see who wants what. Suggestions store no author at all.
const voterRef = (email: string) => accountRef(`snack:${email}`);
// Today's pick uses a keyed ref (server secret), so picks can't be matched to people by hashing emails.
const pickRef = (email: string) => keyedRef("snackpick", email);

const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
// When today's order went in: an admin pressed "Mark ordered" (kept as a setting, so it works
// with nothing picked), or marked a shelf item bought on today's date (office time). Null if not yet.
const ORDER_KEY = "snackOrder";
async function orderedAtToday(items: { orderedAt: string | null }[], today: string) {
  const placed = await store.getSetting<{ date: string; at: string }>(ORDER_KEY);
  const times = [placed?.date === today ? placed.at : null, ...items.map((i) => i.orderedAt)].filter((t): t is string => !!t && istDay(t) === today);
  return times.sort().at(-1) ?? null;
}

async function view(email: string) {
  const today = todayIST();
  const [items, votes, admin, picks, times] = await Promise.all([store.listSnacks(), store.listSnackVotes(), isAdmin(), store.listSnackPicks(today), snackTimes()]);
  const me = voterRef(email);
  const shelfIds = items.filter((i) => i.status === "shelf").map((i) => i.id);
  const orderedAt = await orderedAtToday(items.filter((i) => i.status === "shelf"), today);
  const ordered = !!orderedAt;
  const counts = pickCounts(picks, shelfIds);
  const row = (i: (typeof items)[number]) => ({ id: i.id, name: i.name, note: i.note, orderedAt: i.orderedAt, votes: votes.filter((v) => v.itemId === i.id).length, mine: votes.some((v) => v.itemId === i.id && v.voterRef === me) });
  const byVotes = (a: { votes: number; name: string }, b: { votes: number; name: string }) => b.votes - a.votes || a.name.localeCompare(b.name);
  // Members see the shelf by name (no counts: they change nothing for them); suggestions keep their
  // +N because the +1 is how people push one onto the shelf. Admins get the quantities to order.
  const shelfRows = items.filter((i) => i.status === "shelf").map(row).sort((a, b) => a.name.localeCompare(b.name));
  return {
    shelf: admin ? shelfRows : shelfRows.map(({ votes: _v, ...rest }) => rest),
    suggestions: items.filter((i) => i.status === "suggested").map(row).sort(byVotes),
    // Today's single pick: counts per item and which one is yours. Voter refs stay on the server.
    today: {
      open: pickOpen(new Date(), times, ordered),
      orderAt: times.orderAt,
      ordered,
      ...(admin ? { orderedAt } : {}),
      ...(admin ? { picks: shelfIds.map((itemId) => ({ itemId, count: counts[itemId] ?? 0 })) } : {}),
      mine: picks.find((p) => p.voterRef === pickRef(email))?.itemId ?? null,
    },
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
  // { action: "order-placed" }: today's order went in. Every shelf item someone picked today is
  // marked bought, and members see "Order placed" (picks close).
  if (action === "order-placed") {
    if (!(await isAdmin())) return NextResponse.json({ error: "Only admins can manage the snack shelf" }, { status: 403 });
    const today = todayIST(), now = new Date().toISOString();
    const [items, picks] = await Promise.all([store.listSnacks(), store.listSnackPicks(today)]);
    const picked = new Set(picks.map((p) => p.itemId));
    for (const i of items) if (i.status === "shelf" && picked.has(i.id)) await store.setSnackStatus(i.id, "shelf", now);
    await store.setSetting(ORDER_KEY, { date: today, at: now });
    return NextResponse.json(await view(session.email));
  }
  if (!itemId) return badRequest();
  const item = await store.getSnack(itemId);
  if (!item || item.status === "dismissed") return NextResponse.json({ error: "That snack is no longer listed" }, { status: 404 });
  if (action === "pick" || action === "unpick") {
    const today = todayIST();
    if (!(await inOfficeToday(session.email, today))) return NextResponse.json({ error: "Snacks are for people in the office today. Check in on Home first.", code: "not-in-office" }, { status: 403 });
    const items = await store.listSnacks();
    if (!pickOpen(new Date(), await snackTimes(), !!(await orderedAtToday(items.filter((i) => i.status === "shelf"), today)))) return NextResponse.json({ error: "Today's order is in. Picks open again tomorrow.", code: "closed" }, { status: 409 });
    if (action === "pick" && item.status !== "shelf") return NextResponse.json({ error: "That snack isn't on today's list" }, { status: 409 });
    await store.setSnackPick(today, pickRef(session.email), action === "pick" ? itemId : null);
    return NextResponse.json(await view(session.email));
  }
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
