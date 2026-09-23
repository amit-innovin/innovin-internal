import { NextRequest, NextResponse } from "next/server";
import { currentActor, isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { leaveOverview, summarize } from "@/lib/leave-data";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

// The leave tracker. Balances are per person and per leave type, so this needs a verified
// identity — a device cookie isn't enough to know whose entitlement to apply.
export async function GET(req: NextRequest) {
  const today = todayIST();
  const year = Number(today.slice(0, 4));

  if (req.nextUrl.searchParams.get("scope") === "overview") {
    if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ year, ...(await leaveOverview(year, today)) });
  }

  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ signedIn: false, year }, { status: 200 });

  const [employee, rows, balances] = await Promise.all([
    store.getEmployee(session.email),
    store.listAwayByEmail(session.email, 200),
    store.listLeaveBalances(year),
  ]);
  const person = { name: employee?.name ?? session.name, joinedOn: employee?.joinedOn ?? null };
  const balance = balances.find((b) => b.email === session.email);
  return NextResponse.json({ signedIn: true, name: person.name, ...summarize(person, rows, year, today, balance) });
}

const TYPES = ["cl", "sl", "el", "fl"] as const;

// Admins record a person's balances as they stand in Zoho People. Stored with the moment they
// were taken, so app-side requests are counted on top rather than double-counted.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  const email = str(body.email).trim().toLowerCase();
  if (!email || !(await store.getEmployee(email))) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const input = (body.available ?? {}) as Record<string, unknown>;
  const available: Partial<Record<(typeof TYPES)[number], number>> = {};
  for (const type of TYPES) {
    if (input[type] === undefined || input[type] === null || input[type] === "") continue;
    const days = Number(input[type]);
    // Half-day granularity, and nobody has a thousand days owing.
    if (!Number.isFinite(days) || days < 0 || days > 365 || Math.round(days * 2) !== days * 2) {
      return badRequest(`Enter ${type.toUpperCase()} as a number of days, in halves`);
    }
    available[type] = days;
  }

  const actor = await currentActor();
  const row = await store.setLeaveBalance({
    email,
    year: Number(todayIST().slice(0, 4)),
    available,
    asOf: new Date().toISOString(),
    updatedBy: actor ? actor.name || actor.email : null,
  });
  return NextResponse.json({ ok: true, asOf: row.asOf });
}
