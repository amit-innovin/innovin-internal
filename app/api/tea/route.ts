import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";
const signIn = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });

// One chai round a day. Members see the count and their own place; admins also get the names,
// because they make the round.
async function view(email: string) {
  const date = todayIST();
  const [rows, admin, employees] = await Promise.all([store.listTea(date), isAdmin(), store.listEmployees()]);
  const names = new Map(employees.map((e) => [e.email, (e.name || e.email).split(" ")[0]]));
  return { date, count: rows.length, mine: rows.some((r) => r.email === email), roundAt: "16:00", countsAt: "15:30", names: admin ? rows.map((r) => names.get(r.email) ?? r.email) : null };
}

export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  return NextResponse.json(await view(session.email));
}

export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body || typeof body.going !== "boolean") return badRequest("Say whether you're in");
  await store.setTea(todayIST(), session.email, body.going);
  return NextResponse.json(await view(session.email));
}
