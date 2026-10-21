import { cookies } from "next/headers";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { DEVICE_COOKIE } from "@/lib/cookies";
import { googleConfigured } from "@/lib/google";
import { workspaceData } from "@/lib/workspace";
import { WorkspaceOnboarding } from "./onboarding";
import { WorkspacePortal } from "./portal";

export async function WorkspacePage({ view = "overview" }: { view?: "overview" | "steps" | "planner" }) {
  const jar = await cookies();
  const user = verifyUserSession(jar.get(USER_COOKIE)?.value);
  if (!user) return <WorkspaceOnboarding googleEnabled={googleConfigured()} />;
  return <WorkspacePortal initial={await workspaceData(user, jar.get(DEVICE_COOKIE)?.value)} view={view} />;
}
