import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
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

  const [employee, rows] = await Promise.all([
    store.getEmployee(session.email),
    store.listAwayByEmail(session.email, 200),
  ]);
  const person = { name: employee?.name ?? session.name, joinedOn: employee?.joinedOn ?? null };
  return NextResponse.json({ signedIn: true, name: person.name, ...summarize(person, rows, year, today) });
}
