"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/queries";

// The bell always opens the Notifications page. It never opens the Feed and it is not a popover.
export function BellLink() {
  const unread = useNotifications().data?.unread ?? 0;
  return (
    <Link href="/notifications" className="duo-btn duo-btn-g duo-btn-icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <Bell size={22} strokeWidth={2.2} aria-hidden="true" />
      {unread > 0 && <span className="duo-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}
