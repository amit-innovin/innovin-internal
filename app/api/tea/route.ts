import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { inOfficeToday, snackTimes } from "@/lib/snack-times";
import { currentRound } from "@/lib/snacks-rules";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";
const signIn = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });

// Two tea rounds a day. Members see the round that matters now and their own answer (yes, skip,
// or not answered); no headcount. Admins also get counts and first names per round, because they
// make the tea: tea is the one thing in Tea & snacks that isn't anonymous.
async function view(email: string) {
  const date = todayIST();
  const [times, answers, admin] = await Promise.all([snackTimes(), store.listTeaAnswers(date), isAdmin()]);
  const round = currentRound(new Date(), times);
  const mine = round ? answers.find((a) => a.round === round.id && a.email === email)?.going ?? null : null;
  const base = { date, round, mine, times: { am: times.amAt, pm: times.pmAt } };
  if (!admin) return base;
  const employees = await store.listEmployees();
  const first = new Map(employees.map((e) => [e.email, (e.name || e.email).split(" ")[0]]));
  const going = (r: "am" | "pm") => answers.filter((a) => a.round === r && a.going);
  return { ...base, counts: { am: going("am").length, pm: going("pm").length }, names: { am: going("am").map((a) => first.get(a.email) ?? a.email), pm: going("pm").map((a) => first.get(a.email) ?? a.email) } };
}

export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  return NextResponse.json(await view(session.email));
}

// { round: "am" | "pm", going: true | false | null } — yes, skip, or take the answer back.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body || (body.round !== "am" && body.round !== "pm") || !(typeof body.going === "boolean" || body.going === null)) return badRequest("Say which round, and yes or skip");
  const date = todayIST();
  if (!(await inOfficeToday(session.email, date))) return NextResponse.json({ error: "Tea is for people in the office today. Check in on Home first.", code: "not-in-office" }, { status: 403 });
  const round = currentRound(new Date(), await snackTimes());
  if (!round || round.id !== body.round) return NextResponse.json({ error: "That tea round isn't the current one", code: "wrong-round" }, { status: 409 });
  if (!round.open) return NextResponse.json({ error: `Answers for the ${round.at} round closed at ${round.closesAt}`, code: "closed" }, { status: 409 });
  await store.setTeaAnswer(date, round.id, session.email, body.going);
  return NextResponse.json(await view(session.email));
}
