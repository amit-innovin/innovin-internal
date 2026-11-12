import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/admin";
import { shellProps } from "@/lib/admin-queue";

// Screens rebuilt in the new design live in this group and share the new shell.
export default async function DuoLayout({ children }: { children: ReactNode }) {
  return <AppShell {...await shellProps(await requireUser())}>{children}</AppShell>;
}
