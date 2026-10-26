import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { isAdmin, isOwner } from "@/lib/admin";
import { enforce } from "@/lib/guard";
import { firstName } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";
import type { Role } from "@/lib/types";

// The office directory: everyone who's signed in, plus who's physically/virtually
// in today. Presence shows names and broad tags, with work emails only for directory
// employees. Raw coordinates are never returned.
export async function GET(req: NextRequest) {
  if (!verifyUserSession(req.cookies.get(USER_COOKIE)?.value)) {
    return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  }
  const [employees, dayRows] = await Promise.all([store.listEmployees(), store.listAttendance(todayIST())]);
  const byEmail = new Map(employees.map((e) => [e.email, e]));

  const present = new Map<string, { name: string; email?: string; since: string; where: string }>();
  for (const s of dayRows) {
    if (s.checkOutAt || present.has(s.email)) continue;
    present.set(s.email, {
      name: byEmail.get(s.email)?.name || firstName(s.email) || s.email,
      // The email is attached only when it's already public via the directory — a check-in
      // from someone who never signed in must not expose it through presence.
      email: byEmail.has(s.email) ? s.email : undefined,
      since: s.checkInAt,
      where: locationTag(s.lat, s.lng),
    });
  }

  return NextResponse.json({
    people: employees.map((e) => ({ name: e.name, email: e.email, picture: e.picture, role: e.role, since: e.createdAt })),
    inToday: [...present.values()].sort((a, b) => a.since.localeCompare(b.since)),
  });
}

// Admins can set a joining date. Changing roles is owner-only, and an owner's own role is
// immutable here — owners are set through OWNER_EMAILS, so nobody can demote the owner (or
// promote themselves) via the API.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;

  const body = await readJSON(req);
  const email = str(body?.email).trim().toLowerCase();
  if (!email) return badRequest("Invalid role update");

  const target = await store.getEmployee(email);
  if (!target) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  // Days hit in the pre-app spreadsheet — an admin copies the Total Days column over.
  if (body?.stepsOffset !== undefined) {
    const days = Number(body.stepsOffset);
    if (!Number.isInteger(days) || days < 0 || days > 10_000) return badRequest("Enter whole days");
    await store.setStepsOffset(email, days);
    return NextResponse.json({ ok: true });
  }

  // Joining date drives Earned Leave accrual and Flexible Leave pro-rating; "" clears it.
  if (body?.joinedOn !== undefined) {
    const joinedOn = str(body.joinedOn).trim();
    if (joinedOn && !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) return badRequest("Pick a valid joining date");
    await store.setJoinedOn(email, joinedOn || null);
    return NextResponse.json({ ok: true });
  }

  if (!(await isOwner())) return NextResponse.json({ error: "Only the owner can change roles" }, { status: 403 });
  const role = body?.role as Role;
  if (role !== "admin" && role !== "member") return badRequest("Invalid role update");
  if (target.role === "owner") return NextResponse.json({ error: "The owner's role can't be changed" }, { status: 403 });

  await store.setRole(email, role);
  return NextResponse.json({ ok: true });
}
