"use client";
import { ImportantSheet } from "@/components/m3/important-sheet";
import { useFeed } from "@/lib/queries";
import { WorkspaceLink as Link } from "@/components/m3/workspace-link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, CircleHelp, Cookie, Ellipsis, Footprints, House, LogOut, Newspaper, Settings, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Fab } from "@/components/m3";
import { SpeakUpIcon } from "@/components/m3/icons";
import { readError, send } from "@/lib/fetcher";
import { workspacePath } from "@/lib/workspace-navigation";
import { ACCOUNT_MENU, activeNav, navFor, showsSpeakFab, type NavIcon } from "@/lib/nav";

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
  const view = useSearchParams().get("view");
  const path = pathname === "/" && (isAdmin || !view?.startsWith("admin-")) ? workspacePath(view) : pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [pathname, view]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!account.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const feed = useFeed();
  const fresh = feed.data?.newIds.length ?? 0;
  const badge = (id: string) => (id === "feed" && fresh > 0 ? fresh : 0);
  const sideActive = activeNav(path, "side");
  const barActive = activeNav(path, "bar");
  const onSpeak = path === "/grievances";

  return (
    <div className="m3-app">
      <nav className="m3 m3-side" aria-label="Main">
        <Link href="/" className="m3-wordmark" aria-label="Innovin home">i<span className="m3-navlabel">nnovin</span></Link>
        {navFor("side").map((item) => {
          const Icon = NAV_ICON[item.icon];
          return (
            <Link key={item.id} href={item.href} className="m3-navitem" aria-label={badge(item.id) ? `${item.label}, ${badge(item.id)} new` : item.label} aria-current={sideActive === item.id ? "page" : undefined} style={{ position: "relative" }}>
              <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
              {badge(item.id) > 0 && <span className="m3-dot-badge" aria-hidden="true">{badge(item.id)}</span>}
              <span className="m3-navlabel">{item.label}</span>
            </Link>
          );
        })}
        <Link href="/grievances" className="m3-navitem" aria-label="Speak up" aria-current={onSpeak ? "page" : undefined}>
          <SpeakUpIcon size={22} />
          <span className="m3-navlabel">Speak up</span>
        </Link>

        {isAdmin && (
          <Link href="/admin" className="m3-navitem" aria-current={path.startsWith("/admin") ? "page" : undefined} aria-label={openReports > 0 ? `Admin app, ${openReports} open` : "Admin app"}>
            <ShieldCheck size={22} strokeWidth={1.9} aria-hidden="true" />
            <span className="m3-navlabel">Admin app</span>
            {openReports > 0 && <span className="m3-subbadge" aria-hidden="true" style={{ marginLeft: "auto" }}>{openReports}</span>}
          </Link>
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

      <main className="m3-main">{children}</main>
      <ImportantSheet />

      {showsSpeakFab(path) && <Fab href="/grievances" label="Speak up anonymously" icon={<SpeakUpIcon size={26} />} />}

      <nav className="m3 m3-bottom" aria-label="Main" style={{ gridTemplateColumns: `repeat(${navFor("bar").length}, minmax(0, 1fr))` }}>
        {navFor("bar").map((item) => {
          const Icon = NAV_ICON[item.icon];
          return (
            <Link key={item.id} href={item.href} className="m3-tab" aria-label={badge(item.id) ? `${item.label}, ${badge(item.id)} new` : undefined} aria-current={barActive === item.id ? "page" : undefined}>
              <span className="m3-ind" style={{ position: "relative" }}><Icon size={24} strokeWidth={1.9} aria-hidden="true" />{badge(item.id) > 0 && <span className="m3-dot-badge" aria-hidden="true" style={{ top: -2, right: 8 }}>{badge(item.id)}</span>}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
