import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireAdmin } from "@/lib/admin";
import { shellProps } from "@/lib/admin-queue";

// The rebuilt admin area (D-AdminPhone, D-AdminDesktop, D-AdminDesk-*) in the new shell.
// The old admin screen at /admin/tools sits outside this group and keeps the legacy look.
export default async function AdminDuoLayout({ children }: { children: ReactNode }) {
  return <AppShell {...await shellProps(await requireAdmin())}>{children}</AppShell>;
}
