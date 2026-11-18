"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeft, CalendarCheck, CalendarDays, Coffee, Hand, Heart, Megaphone, MessageSquare, type LucideIcon } from "lucide-react";
import { QueryState } from "@/components/m3";
import { relativeTime } from "@/lib/format";
import type { Notification } from "@/lib/notifications";
import { useMarkNotificationsRead, useNotifications } from "@/lib/queries";

const KIND: Record<Notification["kind"], { icon: LucideIcon; bg: string; color: string }> = {
  tea: { icon: Coffee, bg: "#EBDCFF", color: "#20142F" },
  hi: { icon: Hand, bg: "#FFE08A", color: "#3D2E00" },
  kudos: { icon: Heart, bg: "#FFD9E2", color: "#5C1130" },
  event: { icon: CalendarDays, bg: "#D3E5F5", color: "#0C1D29" },
  away: { icon: CalendarCheck, bg: "#CDEBD6", color: "#0B3D1F" },
  announcement: { icon: Megaphone, bg: "#CAE6FF", color: "#001E30" },
  grievance: { icon: MessageSquare, bg: "#DFE3E8", color: "#181C20" },
};

// Notifications from the Material 3 prototype: plain, and only about things that involve you.
// Opening the page marks them read.
export function NotificationsPage() {
  const feed = useNotifications();
  const markRead = useMarkNotificationsRead();
  const marked = useRef(false);
  useEffect(() => {
    if (feed.data && feed.data.unread > 0 && !marked.current) { marked.current = true; markRead.mutate(); }
  }, [feed.data, markRead]);

  return (
    <div className="m3 m3-page m3-stack">
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <Link href="/" className="m3-btn m3-btn-text m3-back" aria-label="Back to home" style={{ width: 44, padding: 0 }}><ArrowLeft size={22} aria-hidden="true" /></Link>
        <h1 className="m3-h1" style={{ fontSize: 28, lineHeight: "36px" }}>Notifications</h1>
      </header>
      {!feed.data ? <QueryState error={feed.error} onRetry={() => feed.refetch()} what="notifications" /> : feed.data.items.length === 0 ? (
        <p className="m3-body" style={{ margin: "0 4px" }}>Nothing new. You&apos;re all caught up.</p>
      ) : (
        <div className="m3-card" style={{ padding: 0, overflow: "hidden" }}>
          {feed.data.items.map((n) => {
            const k = KIND[n.kind];
            const Icon = k.icon;
            return (
              <Link key={n.id} href={n.href} className="m3-row">
                <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, borderRadius: 20, background: k.bg, color: k.color, display: "grid", placeItems: "center" }}><Icon size={20} /></span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ overflowWrap: "anywhere" }}>{n.title}</span>
                  <span className="m3-small">{[n.body, relativeTime(n.at)].filter(Boolean).join(" · ")}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
