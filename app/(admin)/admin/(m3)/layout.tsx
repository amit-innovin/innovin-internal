import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-app/shell";
import { requireAdmin } from "@/lib/admin";

// The admin app (prototype: docs/design/m3/M3AdminApp.dc.html): its own shell, no member navigation.
// The old admin screen at /admin/tools sits outside this group and keeps the legacy look.
export default async function AdminAppLayout({ children }: { children: ReactNode }) {
  const actor = await requireAdmin();
  return <AdminShell name={actor.name || actor.email} email={actor.email}>{children}</AdminShell>;
}
