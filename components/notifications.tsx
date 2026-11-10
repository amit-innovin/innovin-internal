"use client";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { useNotifications } from "@/lib/queries";

// The bell in the legacy top bar. It links to the Notifications page; the old popover panel is
// gone. Mounted twice (desktop bar and phone header); TanStack Query makes that one request.
export default function Notifications() {
  const unread = useNotifications().data?.unread ?? 0;
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-muted-foreground"
    >
      {unread > 0 ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent-foreground text-[10px] font-semibold text-white tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
