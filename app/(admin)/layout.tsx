import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin";

// Admin pages: members are sent home and never see an admin screen.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
