import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { STEP_GOAL, stepBoard, stepStreak } from "@/lib/steps";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

// The 10K challenge. The board is public inside the app (names are already visible in the
// directory); logging needs a verified Google identity so the count can't be stuffed.
export async function GET(req: NextRequest) {
  const today = todayIST();
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);

  const [employees, rows] = await Promise.all([store.listEmployees(), store.listSteps()]);
  const board = stepBoard(employees, rows, today);

  let me = null;
  if (session) {
    const mine = rows.filter((r) => r.email === session.email);
    const todayRow = mine.find((r) => r.date === today);
    const entry = board.find((b) => b.email === session.email);
    me = {
      email: session.email,
      name: session.name,
      days: entry?.days ?? 0,
      streak: entry?.streak ?? stepStreak(mine.filter((r) => r.hit).map((r) => r.date), today),
      rank: entry ? board.indexOf(entry) + 1 : null,
      today: todayRow ? { hit: todayRow.hit, steps: todayRow.steps } : null,
      recent: mine.slice(0, 14).map((r) => ({ date: r.date, hit: r.hit, steps: r.steps })),
    };
  }

  return NextResponse.json({ goal: STEP_GOAL, today, signedIn: !!session, board, me });
}

// Log today — and only today. Yesterday's walk is history; the sheet never allowed rewriting
// it either. `steps` is optional: when present it decides `hit` on its own (≥ goal = hit).
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in to log your steps" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();

  const steps = body.steps === null || body.steps === undefined || body.steps === "" ? null : Number(body.steps);
  if (steps !== null && (!Number.isInteger(steps) || steps < 0 || steps > 200_000)) {
    return badRequest("Steps should be a whole number");
  }
  // An explicit count settles it; without one, the toggle is the answer.
  const hit = steps !== null ? steps >= STEP_GOAL : body.hit === true;

  const row = await store.setSteps({
    id: id(),
    email: session.email,
    date: todayIST(),
    hit,
    steps,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, hit: row.hit, steps: row.steps });
}
