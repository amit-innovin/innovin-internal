import { requireUser } from "@/lib/admin";
import { workspaceData } from "@/lib/workspace";
import { WorkspacePortal } from "./portal";

// Rendered inside the (member) group, so a signed-in employee is guaranteed.
export async function WorkspacePage({ view = "overview" }: { view?: "overview" | "steps" | "planner" }) {
  const user = await requireUser();
  return <WorkspacePortal initial={await workspaceData(user)} view={view} />;
}
