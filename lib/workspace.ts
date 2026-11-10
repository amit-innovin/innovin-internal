import { attendanceMode } from "./presence";
import { noticeBoard } from "./notices";
import { store } from "./store";
import { todayIST } from "./time";
import { stepsBoard } from "./today";
import { arenaRankings } from "./workspace-model";
import type { Actor } from "./admin";

export async function workspaceData(user: Actor) {
  const today = todayIST();
  const [employees, profiles, attendance, steps, logs, events, announcements, wifi, notices] = await Promise.all([
    store.listEmployees(), store.listWorkspaceProfiles(), store.listAttendance(today),
    stepsBoard(user), store.listSteps(), store.listEvents(new Date(Date.now() - 12 * 3600000).toISOString(), 30),
    store.listAnnouncements(3), store.listWifi(1), noticeBoard(user.email),
  ]);
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const people = employees.map((e) => {
    const p = byEmail.get(e.email);
    return { email: e.email, name: e.name, picture: e.picture, designation: p?.designation ?? "", department: p?.department ?? "", project: p?.project ?? "", desk: p?.desk ?? "", floor: p?.floor ?? "", focus: p?.focus ?? "", mode: attendanceMode(attendance.find(a => a.email === e.email)) };
  });
  const counts = await store.rsvpCounts(events.map((e) => e.id));
  return {
    today, user, notices, canModerate: user.role === "admin", profile: byEmail.get(user.email) ?? null,
    mode: people.find((p) => p.email === user.email)?.mode ?? null,
    people, steps, rankings: arenaRankings(people.map((p) => ({ ...p, stepsOffset: employees.find((e) => e.email === p.email)?.stepsOffset ?? 0 })), logs, today),
    events: events.map(({ createdBy: _, ...e }) => ({ ...e, going: counts[e.id] ?? 0 })),
    announcements, wifi: wifi[0] ? { quality: wifi[0].quality, downMbps: wifi[0].downMbps, createdAt: wifi[0].createdAt } : null,
    prize: process.env.STEPS_PRIZE_DESCRIPTION?.trim() || null,
  };
}
export type WorkspaceData = Awaited<ReturnType<typeof workspaceData>>;
