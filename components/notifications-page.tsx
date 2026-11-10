"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, CalendarDays, Megaphone, MessageSquare, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Flat, PageHeader, Tile, type Tone } from "@/components/duo";
import { Lappy } from "@/components/duo/lappy";
import { relativeTime } from "@/lib/format";
import type { Notification } from "@/lib/notifications";
import { isUnread, useMarkNotificationsRead, useNotifications } from "@/lib/queries";
import { usePush } from "@/lib/use-push";

const KIND: Record<Notification["kind"], { label: string; icon: LucideIcon; tone: Tone }> = {
  announcement: { label: "Announcement", icon: Megaphone, tone: "gold" },
  event: { label: "Event", icon: CalendarDays, tone: "grape" },
  away: { label: "Leave", icon: CalendarCheck, tone: "green" },
  grievance: { label: "Speak up · only on this device", icon: MessageSquare, tone: "sky" },
};

function PushRow() {
  const push = usePush();
  if (push.state === "unsupported") return <span className="duo-sub">This browser can't show push alerts. Speak up updates never leave this device.</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600 }}>Push alerts on this device</span>
        <span className="duo-sub" style={{ fontSize: 12 }}>
          {push.state === "denied" ? "Blocked in your browser settings." : push.state === "on" ? "On. Speak up updates never leave this device." : "Off. Speak up updates never leave this device."}
        </span>
      </div>
      {push.state === "off" && <Button variant="ghost" onClick={push.enable}>Turn on</Button>}
      {push.state === "on" && <Button variant="ghost" onClick={push.disable}>Turn off</Button>}
    </div>
  );
}

export function NotificationsPage() {
  const onlyUnread = useSearchParams().get("filter") === "unread";
  const feed = useNotifications();
  const markRead = useMarkNotificationsRead();

  const items = feed.data?.items ?? [];
  const lastSeen = feed.data?.lastSeen ?? null;
  const unread = feed.data?.unread ?? 0;
  const shown = onlyUnread ? items.filter((item) => isUnread(item, lastSeen)) : items;

  const subtitle = feed.isPending ? "Loading…" : unread ? `${unread} new · everything that needs you, in one place` : "You're all caught up";

  return (
    <div className="duo-col duo-screen-in">
      <PageHeader title="Notifications" subtitle={subtitle} back={{ href: "/", label: "Back to home" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Link href="/notifications" replace className="duo-chip" aria-current={!onlyUnread ? "true" : undefined}>All<span className="duo-chip-count">{items.length}</span></Link>
        <Link href="/notifications?filter=unread" replace className="duo-chip" aria-current={onlyUnread ? "true" : undefined}>Unread<span className="duo-chip-count">{unread}</span></Link>
        <span style={{ flexGrow: 1 }} />
        <Button
          variant="text"
          disabled={!unread || markRead.isPending}
          onClick={() => markRead.mutate(undefined, { onError: () => toast.error("Couldn't mark updates as read. Try again.") })}
        >
          Mark all read
        </Button>
      </div>

      {feed.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-busy="true" aria-label="Loading notifications">
          {[0, 1, 2].map((i) => <div key={i} className="duo-flat" style={{ height: 66 }} />)}
        </div>
      ) : feed.isError ? (
        <Card role="alert" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <span className="duo-h2">Couldn't load your notifications</span>
          <span className="duo-sub">{feed.error.message}</span>
          <Button onClick={() => feed.refetch()}>Try again</Button>
        </Card>
      ) : shown.length === 0 ? (
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px", textAlign: "center" }}>
          <Lappy pose="idle" width={120} decorative />
          <span className="duo-h2">{onlyUnread ? "Nothing unread" : "Nothing new in the last month"}</span>
          <span className="duo-sub">Announcements, events, leave decisions and Speak up updates show up here.</span>
        </Card>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((item) => {
            const kind = KIND[item.kind];
            const fresh = isUnread(item, lastSeen);
            return (
              <li key={item.id}>
                <Link href={item.href} className="duo-row" data-unread={fresh}>
                  <Tile tone={kind.tone}><kind.icon size={20} strokeWidth={2.2} /></Tile>
                  <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>{item.title}</span>
                    <span style={{ fontSize: 12, color: "var(--duo-muted)" }}>{kind.label} · {relativeTime(item.at)}</span>
                  </span>
                  {fresh && <span style={{ width: 10, height: 10, borderRadius: 5, background: "var(--duo-primary)", flexShrink: 0 }}><span className="sr-only">Unread</span></span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Until the Account page is rebuilt, this is where push alerts are turned on and off. */}
      <Flat><PushRow /></Flat>
    </div>
  );
}
