import type { ReactNode } from "react";
import { AppShell } from "@/components/m3/app-shell";
import { requireUser } from "@/lib/admin";
import { shellProps } from "@/lib/admin-queue";

// Member screens live in this group and share the Material 3 shell.
export default async function MemberShellLayout({ children }: { children: ReactNode }) {
  return <AppShell {...await shellProps(await requireUser())}>{children}</AppShell>;
}
