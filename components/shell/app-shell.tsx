"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, CircleHelp, Cookie, Ellipsis, Footprints, House, LogOut, MessageSquare, Newspaper, Settings, ShieldCheck, UserRound, Wifi, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/duo";
import { readError, send } from "@/lib/fetcher";
import { ACCOUNT_MENU, ADMIN_NAV, activeAdmin, activeNav, navFor, type NavIcon } from "@/lib/nav";

const NAV_ICON: Record<NavIcon, LucideIcon> = { home: House, feed: Newspaper, days: CalendarDays, snacks: Cookie, steps: Footprints, reading: BookOpen, account: UserRound };
const MENU_ICON = { settings: Settings, speak: MessageSquare, wifi: Wifi, help: CircleHelp, admin: ShieldCheck };

async function signOut() {
  const res = await send("/api/auth/logout", { method: "POST" });
  if (!res.ok) return toast.error(await readError(res));
  window.location.assign("/");
}

// The app frame from the design canvas: bottom bar on phones, icon sidebar on tablets, full
// sidebar from 1100px. Which one shows is pure CSS (app/duo.css), so there is no layout flash.
// `openReports` is the open Speak up count for the admin badge (admins only).
export function AppShell({ name, isAdmin, openReports = 0, children }: { name: string; isAdmin: boolean; openReports?: number; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!account.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const sideActive = activeNav(pathname, "side");
  const barActive = activeNav(pathname, "bar");
  const adminActive = activeAdmin(pathname);
  // On laptop the sub-pages carry the highlight; the tablet's icon sidebar has no sub-pages,
  // so there the Admin icon itself lights up (CSS: .duo-navitem[data-open]).

  return (
    <div className="duo">
      <nav className="duo-side" aria-label="Main">
        <Link href="/" className="duo-wordmark" aria-label="Innovin home">i<span className="duo-wordmark-rest">nnovin</span></Link>
        {navFor("side").map((item) => {
          const Icon = NAV_ICON[item.icon];
          return (
            <Link key={item.id} href={item.href} className="duo-navitem" aria-label={item.label} aria-current={sideActive === item.id ? "page" : undefined}>
              <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
              <span className="duo-navlabel">{item.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <>
            <Link href="/admin" className="duo-navitem" aria-label="Admin" data-open={adminActive ? "true" : undefined}>
              <ShieldCheck size={22} strokeWidth={2.2} aria-hidden="true" />
              <span className="duo-navlabel">Admin</span>
            </Link>
            <div className="duo-subnav" aria-label="Admin pages" role="group">
              {ADMIN_NAV.map((item) => (
                <Link key={item.id} href={item.href} className="duo-subitem" aria-current={adminActive === item.id ? "page" : undefined}>
                  {item.label}
                  {item.id === "speak" && openReports > 0 && <span className="duo-subbadge" aria-label={`${openReports} open`}>{openReports}</span>}
                </Link>
              ))}
            </div>
          </>
        )}
        <div className="duo-acct" ref={account}>
          {menuOpen && (
            <div className="duo-menu" role="menu" aria-label="Account">
              {ACCOUNT_MENU().map((item) => {
                const Icon = MENU_ICON[item.icon];
                return <Link key={item.href} href={item.href} role="menuitem" className="duo-menuitem"><Icon size={18} strokeWidth={2.2} aria-hidden="true" />{item.label}</Link>;
              })}
              <div style={{ height: 2, background: "var(--duo-line)", margin: "4px 6px" }} />
              <button type="button" role="menuitem" className="duo-menuitem" style={{ color: "var(--duo-pink-text)" }} onClick={signOut}><LogOut size={18} strokeWidth={2.2} aria-hidden="true" />Sign out</button>
            </div>
          )}
          <button type="button" className="duo-acct-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu" onClick={() => setMenuOpen((open) => !open)}>
            <Avatar name={name} />
            <span className="duo-acct-text">
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 15, fontWeight: 600 }}>{name}</span>
              <span style={{ fontSize: 12, color: "var(--duo-muted)" }}>Account</span>
            </span>
            <Ellipsis size={18} className="duo-acct-text" style={{ flexGrow: 0 }} aria-hidden="true" />
          </button>
        </div>
      </nav>

      <main className="duo-main">{children}</main>

      <nav className="duo-bottom" aria-label="Main" style={{ gridTemplateColumns: `repeat(${navFor("bar").length}, minmax(0, 1fr))` }}>
        {navFor("bar").map((item) => {
          const Icon = NAV_ICON[item.icon];
          return (
            <Link key={item.id} href={item.href} className="duo-tab" aria-current={barActive === item.id ? "page" : undefined}>
              <Icon size={24} strokeWidth={2.2} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
