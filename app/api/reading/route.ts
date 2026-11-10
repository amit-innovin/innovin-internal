import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";
const signIn = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });

// The reading list. Colleagues only ever see counts per book, never who is reading what.
async function view(email: string) {
  const [books, readings] = await Promise.all([store.listBooks(), store.listReadings()]);
  const year = todayIST().slice(0, 4);
  const mine = readings.filter((r) => r.email === email);
  const reading = mine.find((r) => r.status === "reading");
  const book = reading && books.find((b) => b.id === reading.bookId);
  return {
    current: reading && book ? { bookId: book.id, title: book.title, author: book.author, page: reading.page, pages: reading.pages, pct: reading.pages ? Math.min(100, Math.round((100 * reading.page) / reading.pages)) : 0 } : null,
    shelf: books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      read: readings.filter((r) => r.bookId === b.id && r.status === "done").length,
      want: readings.filter((r) => r.bookId === b.id && r.status === "want").length,
      mine: mine.find((r) => r.bookId === b.id)?.status ?? null,
    })).reverse(),
    finishedThisYear: readings.filter((r) => r.status === "done" && r.updatedAt.startsWith(year)).length,
  };
}

export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  return NextResponse.json(await view(session.email));
}

// Recommend a book: { title, author }. The same title twice is the same book.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const title = str(body?.title).trim(), author = str(body?.author).trim();
  if (!title || title.length > 120 || author.length > 80) return badRequest("Give the book's title (and author) in under 120 characters");
  if (!(await store.listBooks()).some((b) => b.title.toLowerCase() === title.toLowerCase())) await store.addBook({ id: id(), title, author, createdAt: new Date().toISOString() });
  return NextResponse.json(await view(session.email), { status: 201 });
}

// { bookId, action }: "want" / "unwant" the team shelf toggle; "start" (needs { pages });
// "progress" (adds { pages } read); "finish"; "stop" (back on your list).
export async function PATCH(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const bookId = str(body?.bookId), action = str(body?.action);
  if (!(await store.listBooks()).some((b) => b.id === bookId)) return NextResponse.json({ error: "That book isn't on the shelf" }, { status: 404 });
  const now = new Date().toISOString();
  const readings = (await store.listReadings()).filter((r) => r.email === session.email);
  const current = readings.find((r) => r.bookId === bookId);
  const pagesIn = Number(body?.pages);
  const set = (status: "want" | "reading" | "done", page: number, pages: number) => store.setReading({ email: session.email, bookId, status, page, pages, updatedAt: now });

  if (action === "want") await set("want", 0, current?.pages ?? 0);
  else if (action === "unwant") await store.clearReading(session.email, bookId);
  else if (action === "start") {
    if (!Number.isInteger(pagesIn) || pagesIn < 1 || pagesIn > 5000) return badRequest("How many pages does it have?");
    // One book at a time: whatever you were reading goes back on your list.
    for (const r of readings.filter((r) => r.status === "reading" && r.bookId !== bookId)) await store.setReading({ ...r, status: "want", updatedAt: now });
    await set("reading", 0, pagesIn);
  } else if (action === "progress") {
    if (current?.status !== "reading") return NextResponse.json({ error: "Start the book first" }, { status: 409 });
    if (!Number.isInteger(pagesIn) || pagesIn < 1 || pagesIn > 5000) return badRequest("Add a number of pages");
    await set("reading", Math.min(current.pages, current.page + pagesIn), current.pages);
  } else if (action === "finish") {
    if (current?.status !== "reading") return NextResponse.json({ error: "Start the book first" }, { status: 409 });
    await set("done", current.pages, current.pages);
  } else if (action === "stop") {
    if (current?.status !== "reading") return NextResponse.json({ error: "You're not reading that one" }, { status: 409 });
    await set("want", current.page, current.pages);
  } else return badRequest("Unknown action");
  return NextResponse.json(await view(session.email));
}
