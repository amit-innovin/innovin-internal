import { attendanceMode } from "./presence";
import { store } from "./store";
import { todayIST } from "./time";
import { stepsBoard } from "./today";
import type { Actor } from "./admin";

// What Home still reads from here: your own step count and today's mode. Nothing about anyone
// else (no headcounts, no one else's day): those stay admin-only.
export async function workspaceData(user: Actor) {
  const today = todayIST();
  const [profiles, mine, steps] = await Promise.all([store.listWorkspaceProfiles(), store.getAttendance(user.email, today), stepsBoard(user)]);
  return { today, user, profile: profiles.find((p) => p.email === user.email) ?? null, mode: attendanceMode(mine), steps };
}
export type WorkspaceData = Awaited<ReturnType<typeof workspaceData>>;
