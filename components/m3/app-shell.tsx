"use client";
import { ImportantSheet } from "@/components/m3/important-sheet";
import { useFeed, useNotifications } from "@/lib/queries";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, CalendarDays, CircleHelp, Coffee, LayoutGrid, LogOut, Newspaper, Settings, Sun, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/m3";
import { SpeakUpIcon } from "@/components/m3/icons";
import { readError, send } from "@/lib/fetcher";
import { ACCOUNT_MENU, activeNav, navFor, type NavIcon } from "@/lib/nav";

const NAV_ICON: Record<NavIcon, LucideIcon> = { today: Sun, feed: Newspaper, days: CalendarDays, snacks: Coffee, browse: LayoutGrid };
const MENU_ICON = { settings: Settings, help: CircleHelp };

async function signOut() {
  const res = await send("/api/auth/logout", { method: "POST" });
  if (!res.ok) return toast.error(await readError(res));
  window.location.assign("/");
}

// The avatar menu: Settings, Help and Sign out. Used in the top bar and on Today's title on phones.
export function AccountButton({ name, size = 40, align = "right" }: { name: string; size?: number; align?: "right" | "left" }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button type="button" className="m3-avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        <Avatar name={name} size={size} />
      </button>
      {open && (
        <div className="m3-menu m3-menu-down" role="menu" aria-label="Account" style={align === "right" ? { right: 0 } : { left: 0 }}>
          <span className="m3-menu-name">{name}</span>
          {ACCOUNT_MENU().map((item) => {
            const Icon = MENU_ICON[item.icon];
            return <Link key={item.href} href={item.href} role="menuitem" className="m3-menuitem"><Icon size={18} strokeWidth={1.9} aria-hidden="true" />{item.label}</Link>;
          })}
          <button type="button" role="menuitem" className="m3-menuitem" style={{ color: "var(--m3-error)" }} onClick={signOut}><LogOut size={18} strokeWidth={1.9} aria-hidden="true" />Sign out</button>
        </div>
      )}
    </div>
  );
}

export function NotificationsBell({ className = "m3-icon-btn" }: { className?: string }) {
  const unread = useNotifications().data?.unread ?? 0;
  return (
    <Link href="/notifications" className={className} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <Bell size={22} strokeWidth={1.8} aria-hidden="true" />
      {unread > 0 && <span className="m3-dot-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}

// Speak up is what the app was built for, so phones keep it one tap away on the main pages.
const SPEAK_FAB = ["/", "/feed", "/days", "/snacks", "/browse", "/steps", "/wifi"];

// The app frame (design: "Today", no sidebar). From 768px: a top bar with the wordmark, the five
// destinations as a floating tab bar in the middle, and the bell and avatar on the right. Phones:
// the Material bottom bar with the same five. Pure CSS switches between them (app/m3.css).
// `openReports` is the open Speak up count, shown on Browse for admins.
export function AppShell({ name, isAdmin, openReports = 0, children }: { name: string; isAdmin: boolean; openReports?: number; children: ReactNode }) {
  const pathname = usePathname();
  const feed = useFeed();
  const fresh = feed.data?.newIds.length ?? 0;
  const active = activeNav(pathname);
  const badge = (id: NavIcon) => (id === "feed" ? fresh : id === "browse" && isAdmin ? openReports : 0);
  const label = (id: NavIcon, text: string) => (badge(id) ? `${text}, ${badge(id)} ${id === "feed" ? "new" : "open"}` : text);

  return (
    <div className="m3-app">
      <header className="m3 m3-top">
        <Link href="/" className="m3-wordmark" aria-label="innovin, Today">innovin</Link>
        <nav className="m3-toptabs" aria-label="Main">
          {navFor("top").map((item) => {
            const Icon = NAV_ICON[item.icon];
            return (
              <Link key={item.id} href={item.href} className="m3-toptab" aria-label={label(item.id, item.label)} aria-current={active === item.id ? "page" : undefined}>
                <Icon size={20} strokeWidth={1.9} aria-hidden="true" />{item.label}
                {badge(item.id) > 0 && <span className="m3-subbadge" aria-hidden="true">{badge(item.id)}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="m3-top-end">
          {pathname !== "/grievances" && <Link href="/grievances" className="m3-speak-pill"><SpeakUpIcon size={18} />Speak up</Link>}
          <NotificationsBell />
          <AccountButton name={name} />
        </div>
      </header>

      <main className="m3-main">{children}</main>
      <ImportantSheet />
      {SPEAK_FAB.includes(pathname) && <Link href="/grievances" className="m3 m3-speak-fab" aria-label="Speak up anonymously"><SpeakUpIcon size={22} />Speak up</Link>}

      <nav className="m3 m3-bottom" aria-label="Main" style={{ gridTemplateColumns: `repeat(${navFor("bar").length}, minmax(0, 1fr))` }}>
        {navFor("bar").map((item) => {
          const Icon = NAV_ICON[item.icon];
          return (
            <Link key={item.id} href={item.href} className="m3-tab" aria-label={badge(item.id) ? label(item.id, item.label) : undefined} aria-current={active === item.id ? "page" : undefined}>
              <span className="m3-ind" style={{ position: "relative" }}><Icon size={24} strokeWidth={1.9} aria-hidden="true" />{badge(item.id) > 0 && <span className="m3-dot-badge" aria-hidden="true" style={{ top: -2, right: 8 }}>{badge(item.id)}</span>}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
