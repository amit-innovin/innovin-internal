"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isDuoRoute } from "@/lib/nav";

// Screens already rebuilt in the new design bring their own shell (components/shell/app-shell).
// Everything else keeps the legacy top bar and page frame until its turn comes.
export function LegacyFrame({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  if (isDuoRoute(usePathname())) return <>{children}</>;
  return (
    <>
      {nav}
      <main className="studio-main">{children}</main>
    </>
  );
}
