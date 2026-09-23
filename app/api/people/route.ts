import { NextResponse } from "next/server";
import { firstName } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

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
    people: employees.map((e) => ({ name: e.name, email: e.email, picture: e.picture, since: e.createdAt })),
    inToday: [...present.values()].sort((a, b) => a.since.localeCompare(b.since)),
  });
}
