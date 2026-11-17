"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, CircleHelp, Cookie, Ellipsis, Footprints, House, LogOut, Newspaper, Settings, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Fab } from "@/components/m3";
import { SpeakUpIcon } from "@/components/m3/icons";
import { readError, send } from "@/lib/fetcher";
import { ACCOUNT_MENU, ADMIN_NAV, activeAdmin, activeNav, navFor, showsSpeakFab, type NavIcon } from "@/lib/nav";

const NAV_ICON: Record<NavIcon, LucideIcon> = { home: House, feed: Newspaper, days: CalendarDays, snacks: Cookie, steps: Footprints, account: UserRound };
const MENU_ICON = { settings: Settings, help: CircleHelp };

async function signOut() {
  const res = await send("/api/auth/logout", { method: "POST" });
  if (!res.ok) return toast.error(await readError(res));
  window.location.assign("/");
}

// The app frame from the Material 3 prototype: a bottom bar on phones, an icon sidebar on tablets
// and a full sidebar from 1100px (pure CSS in app/m3.css, so no layout flash). Screens that haven't
// moved to Material 3 yet keep their Duo styling, so the root carries both classes.
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
  const onSpeak = pathname === "/grievances" || pathname.startsWith("/grievances/");

  return (
    <div className="m3 duo m3-app">
      <nav className="m3-side" aria-label="Main">
        <Link href="/" className="m3-wordmark" aria-label="Innovin home">i<span className="m3-navlabel">nnovin</span></Link>
        {navFor("side").map((item) => {
          const Icon = NAV_ICON[item.icon];
          return (
            <Link key={item.id} href={item.href} className="m3-navitem" aria-label={item.label} aria-current={sideActive === item.id ? "page" : undefined}>
              <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
              <span className="m3-navlabel">{item.label}</span>
            </Link>
          );
        })}
        <Link href="/grievances" className="m3-navitem" aria-label="Speak up" aria-current={onSpeak ? "page" : undefined}>
          <SpeakUpIcon size={22} />
          <span className="m3-navlabel">Speak up</span>
        </Link>
        {isAdmin && (
          <>
            <Link href="/admin" className="m3-navitem" aria-label="Admin" data-open={adminActive ? "true" : undefined}>
              <ShieldCheck size={22} strokeWidth={1.9} aria-hidden="true" />
              <span className="m3-navlabel">Admin</span>
            </Link>
            <div className="m3-subnav" aria-label="Admin pages" role="group">
              {ADMIN_NAV.map((item) => (
                <Link key={item.id} href={item.href} className="m3-subitem" aria-current={adminActive === item.id ? "page" : undefined}>
                  {item.label}
                  {item.id === "speak" && openReports > 0 && <span className="m3-subbadge" aria-label={`${openReports} open`}>{openReports}</span>}
                </Link>
              ))}
            </div>
          </>
        )}
        <div className="m3-acct" ref={account}>
          {menuOpen && (
            <div className="m3-menu" role="menu" aria-label="Account">
              {ACCOUNT_MENU().map((item) => {
                const Icon = MENU_ICON[item.icon];
                return <Link key={item.href} href={item.href} role="menuitem" className="m3-menuitem"><Icon size={18} strokeWidth={1.9} aria-hidden="true" />{item.label}</Link>;
              })}
              <button type="button" role="menuitem" className="m3-menuitem" style={{ color: "var(--m3-error)" }} onClick={signOut}><LogOut size={18} strokeWidth={1.9} aria-hidden="true" />Sign out</button>
            </div>
          )}
          <button type="button" className="m3-acct-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu" onClick={() => setMenuOpen((open) => !open)}>
            <Avatar name={name} size={36} />
            <span className="m3-navlabel m3-acct-text">
              <span style={{ fontWeight: 600 }}>{name}</span>
              <span className="m3-small">Account &amp; settings</span>
            </span>
            <Ellipsis size={18} className="m3-navlabel" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <main className="duo-main m3-main">{children}</main>

      {showsSpeakFab(pathname) && <Fab href="/grievances" label="Speak up anonymously" icon={<SpeakUpIcon size={26} />} />}

      <nav className="m3-bottom" aria-label="Main" style={{ gridTemplateColumns: `repeat(${navFor("bar").length}, minmax(0, 1fr))` }}>
        {navFor("bar").map((item) => {
          const Icon = NAV_ICON[item.icon];
          return (
            <Link key={item.id} href={item.href} className="m3-tab" aria-current={barActive === item.id ? "page" : undefined}>
              <span className="m3-ind"><Icon size={24} strokeWidth={1.9} aria-hidden="true" /></span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
