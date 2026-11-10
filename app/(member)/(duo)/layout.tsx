import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/admin";

// Screens rebuilt in the new design live in this group and share the new shell.
export default async function DuoLayout({ children }: { children: ReactNode }) {
  const actor = await requireUser();
  return <AppShell name={actor.name || actor.email} isAdmin={actor.role === "admin"}>{children}</AppShell>;
}
