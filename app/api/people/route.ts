import { NextRequest, NextResponse } from "next/server";
import { isOwner } from "@/lib/admin";
import { enforce } from "@/lib/guard";
import { firstName } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";
import type { Role } from "@/lib/types";

// The office directory: everyone who's signed in, plus who's physically/virtually
// in today. Presence shows a name and a broad tag — never raw coordinates or emails.
export async function GET() {
  const [employees, sessions] = await Promise.all([store.listEmployees(), store.listAttendance(todayIST())]);
  const byEmail = new Map(employees.map((e) => [e.email, e]));

  const present = new Map<string, { name: string; since: string; where: string }>();
  for (const s of sessions) {
    if (s.checkOutAt || present.has(s.email)) continue;
    present.set(s.email, {
      name: byEmail.get(s.email)?.name || firstName(s.email) || s.email,
      since: s.checkInAt,
      where: locationTag(s.lat, s.lng),
    });
  }

  return NextResponse.json({
    people: employees.map((e) => ({ name: e.name, email: e.email, picture: e.picture, role: e.role, since: e.createdAt })),
    inToday: [...present.values()].sort((a, b) => a.since.localeCompare(b.since)),
  });
}

// Grant or revoke admin. Owner-only, and an owner's own role is immutable here — owners are
// set through OWNER_EMAILS, so nobody can demote the owner (or promote themselves) via the API.
export async function PATCH(req: NextRequest) {
  if (!(await isOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;

  const body = await readJSON(req);
  const email = str(body?.email).trim().toLowerCase();
  const role = body?.role as Role;
  if (!email || (role !== "admin" && role !== "member")) return badRequest("Invalid role update");

  const target = await store.getEmployee(email);
  if (!target) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "The owner's role can't be changed" }, { status: 403 });

  await store.setRole(email, role);
  return NextResponse.json({ ok: true });
}
