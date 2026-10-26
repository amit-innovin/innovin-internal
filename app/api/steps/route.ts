import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { STEP_GOAL } from "@/lib/steps";
import { id, store } from "@/lib/store";
import { stepsBoard } from "@/lib/today";
import { todayIST } from "@/lib/time";

// The 10K challenge contains employee identities and activity, so reads and writes
// both require the same verified identity as the directory.
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  return NextResponse.json(await stepsBoard(session));
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
