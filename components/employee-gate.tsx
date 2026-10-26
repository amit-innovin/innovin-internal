import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { WorkspaceOnboarding } from "@/components/workspace/onboarding";

export async function EmployeeGate({ children, next }: { children: ReactNode; next: string }) {
  if (!(await currentUser())) return <WorkspaceOnboarding googleEnabled={googleConfigured()} next={next} />;
  return children;
}
