import { attendanceMode } from "./presence";
import { isAdmin } from "./admin";
import { noticeBoard } from "./notices";
import { store } from "./store";
import { todayIST } from "./time";
import { snacksMine, stepsBoard } from "./today";
import { arenaRankings } from "./workspace-model";
import type { UserSession } from "./auth";

export async function workspaceData(user: UserSession, deviceId?: string) {
  const today = todayIST();
  const [employees, profiles, attendance, snacks, steps, logs, events, announcements, wifi, notices, canModerate] = await Promise.all([
    store.listEmployees(), store.listWorkspaceProfiles(), store.listAttendance(today), snacksMine(deviceId, user.email),
    stepsBoard(user), store.listSteps(), store.listEvents(new Date(Date.now() - 12 * 3600000).toISOString(), 30),
    store.listAnnouncements(3), store.listWifi(1), noticeBoard(user.email), isAdmin(),
  ]);
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const people = employees.map((e) => {
    const p = byEmail.get(e.email);
    return { email: e.email, name: e.name, picture: e.picture, designation: p?.designation ?? "", department: p?.department ?? "", project: p?.project ?? "", desk: p?.desk ?? "", floor: p?.floor ?? "", focus: p?.focus ?? "", mode: attendanceMode(attendance.find(a => a.email === e.email)) };
  });
  const counts = await store.rsvpCounts(events.map((e) => e.id));
  return {
    today, user, notices, canModerate, profile: byEmail.get(user.email) ?? null,
    mode: people.find((p) => p.email === user.email)?.mode ?? null,
    people, snacks, steps, rankings: arenaRankings(people.map((p) => ({ ...p, stepsOffset: employees.find((e) => e.email === p.email)?.stepsOffset ?? 0 })), logs, today),
    events: events.map(({ createdBy: _, ...e }) => ({ ...e, going: counts[e.id] ?? 0 })),
    announcements, wifi: wifi[0] ? { quality: wifi[0].quality, downMbps: wifi[0].downMbps, createdAt: wifi[0].createdAt } : null,
    prize: process.env.STEPS_PRIZE_DESCRIPTION?.trim() || null,
  };
}
export type WorkspaceData = Awaited<ReturnType<typeof workspaceData>>;

export async function officePantryAllowed(email: string | undefined) {
  if (!email) return false;
  const today = todayIST();
  return attendanceMode(await store.getAttendance(email, today)) === "office";
}
