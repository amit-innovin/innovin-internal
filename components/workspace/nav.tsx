"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Footprints, LayoutGrid, Settings, LogOut, RefreshCw, UserRound, Wifi } from "lucide-react";
import { send, readError } from "@/lib/fetcher";
import { toast } from "sonner";
import Notifications from "@/components/notifications";

const links = [{ href: "/", label: "Overview", icon: LayoutGrid }, { href: "/steps", label: "Daily Steps", icon: Footprints }, { href: "/attendance?tab=leave", label: "Attendance & Leave", icon: CalendarDays }];
const BRAND = <Link href="/" className="studio-wordmark nav-brand" aria-label="Innovin Internal home"><span className="flowbooks-logo-mark small"><svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3L22.5 14.2L32 7.8L26.2 17.5L37 20L26.2 22.5L32 32.2L22.5 25.8L20 37L17.5 25.8L8 32.2L13.8 22.5L3 20L13.8 17.5L8 7.8L17.5 14.2L20 3Z" fill="#FA845E" /></svg></span><span className="brand-text-wrap"><span className="nav-brand-title">innovin<span className="brand-coral-dot">.internal</span></span><span className="nav-workspace-tag">Your team workspace</span></span></Link>;

export function WorkspaceNav({ signedIn, showAdmin, userEmail }: { signedIn: boolean; showAdmin: boolean; userEmail?: string }) {
  const path = usePathname();
  const params=useSearchParams();
  const brand = BRAND;
  // Signed out, the only pages are sign-in (which has its own header) and anonymous Speak Up:
  // show the brand and a way to sign in, never the workspace tools.
  if (!signedIn) {
    if (path === "/sign-in") return null;
    return <header className="studio-nav top-nav zip-nav"><div className="nav-left">{brand}</div><div className="nav-right"><a className="wifi-status-pill" href={`/api/auth/google?next=${encodeURIComponent(path)}`}>Sign in</a></div></header>;
  }
  return <header className="studio-nav top-nav zip-nav">
    <div className="nav-left">{brand}
      <nav aria-label="Workspace navigation" className="nav-links studio-nav-primary">{links.map(l => <Link key={l.href} href={l.href} className={`nav-link ${path === l.href.split("?")[0] ? "active" : ""}`} aria-current={path === l.href.split("?")[0] ? "page" : undefined}><l.icon size={16} /><span>{l.label}</span></Link>)}</nav>
    </div>
    <div className="nav-right"><Link className="wifi-status-pill" href="/wifi?check=1"><Wifi size={15} /><span>Wi-Fi pulse</span></Link>
      <div className="studio-nav-tools"><Link className="mobile-nav-only" href="/attendance?tab=leave" aria-label="Attendance & Leave"><CalendarDays size={18} /></Link><Notifications /><Link href="/settings" aria-label="Settings"><Settings size={16} /></Link>{signedIn && <details className="studio-account"><summary aria-label="Your Google account"><UserRound size={16} /></summary><div><small>Signed in with Google</small><strong>{userEmail}</strong><a href={`/api/auth/google?next=${encodeURIComponent(path + (params.size ? `?${params}` : ""))}`}><RefreshCw size={14} />Switch Google account</a><button onClick={async () => { const res = await send("/api/auth/logout", { method: "POST" }); if (!res.ok) return toast.error(await readError(res)); window.location.assign("/"); }}><LogOut size={14} />Sign out</button></div></details>}</div>
      <details className="reference-more" onClick={e=>{if((e.target as HTMLElement).closest("a"))e.currentTarget.open=false;}}><summary>More</summary><nav className="studio-nav-more" aria-label="More workspace tools">{[["/events", "Events"], ["/grievances", "Speak Up"], ["/wifi", "Wi-Fi"], ["/help", "Help"], ...(showAdmin ? [["/admin", "Admin"]] : [])].map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>)}</nav></details>
    </div>
  </header>;
}
