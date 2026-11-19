"use client";
// The admin app's own frame (prototype: docs/design/m3/M3AdminApp.dc.html, M3AdminAppPhone.dc.html):
// a top bar with tabs on laptops (no sidebar, as in the member app); on phones a top bar with a way back to the member app and a bottom bar
// whose More holds Office, Wi-Fi reports and the member app. No member navigation in here.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Building2, CalendarDays, Ellipsis, ExternalLink, Megaphone, ShieldCheck, Users, Wifi, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import { useAllGrievances, useReported } from "@/lib/queries";
import { MeContext, SnackProvider } from "./ui";

type Page = { id: string; label: string; href: string; icon: LucideIcon; sub?: string };
export const ADMIN_PAGES: Page[] = [
  { id: "today", label: "Today", href: "/admin", icon: CalendarDays },
  { id: "people", label: "People", href: "/admin/people", icon: Users },
  { id: "speak", label: "Speak up", href: "/admin/speak-up", icon: ShieldCheck },
  { id: "publish", label: "Publish", href: "/admin/publish", icon: Megaphone },
  { id: "office", label: "Office", href: "/admin/office", icon: Building2, sub: "Closed days, tea and snack times, snack shelf" },
  { id: "wifi", label: "Wi-Fi reports", href: "/admin/wifi", icon: Wifi, sub: "Slow Wi-Fi reports" },
];
const BAR = ["today", "people", "speak", "publish"];
const MORE = ["office", "wifi"];

const activePage = (pathname: string) =>
  pathname === "/admin" ? "today" : ADMIN_PAGES.find((p) => p.href !== "/admin" && (pathname === p.href || pathname.startsWith(`${p.href}/`)))?.id ?? null;

export function AdminShell({ name, email, children }: { name: string; email: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = activePage(pathname);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  // Speak up's badge: new messages plus reported posts, the two things waiting there.
  const grievances = useAllGrievances();
  const reported = useReported();
  const waiting = (grievances.data?.filter((g) => g.status === "open").length ?? 0) + (reported.data?.length ?? 0);
  const badge = (id: string) => (id === "speak" && waiting > 0 ? waiting : 0);

  return (
    <MeContext.Provider value={email}>
      <div className="m3 m3a">
    <SnackProvider>
        <header className="m3a-topbar">
          <Link href="/admin" className="m3a-brand" aria-label="innovin admin, Today"><b>innovin</b><span>admin</span></Link>
          <nav className="m3-toptabs" aria-label="Admin">
            {ADMIN_PAGES.map((p) => (
              <Link key={p.id} href={p.href} className="m3-toptab" aria-current={active === p.id ? "page" : undefined}>
                <p.icon size={18} strokeWidth={1.9} aria-hidden="true" />{p.label}{badge(p.id) > 0 && <span className="vh">, {badge(p.id)} new</span>}
                {badge(p.id) > 0 && <span className="m3-subbadge" aria-hidden="true">{badge(p.id)}</span>}
              </Link>
            ))}
          </nav>
          <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/" className="m3-btn m3-btn-text" style={{ height: 40 }}><ExternalLink size={18} strokeWidth={1.9} aria-hidden="true" />Member app</a>
            <span title={`${name} · Admin`}><Avatar name={name} size={40} /></span>
          </div>
        </header>

        <div className="m3a-col">
          <header className="m3a-top">
            <Link href="/admin" className="m3a-brand" aria-label="innovin admin, Today"><b>innovin</b><span>admin</span></Link>
            <span style={{ flex: 1 }} />
            <a href="/" className="m3-btn m3-btn-text" style={{ height: 48 }}><ExternalLink size={18} strokeWidth={1.9} aria-hidden="true" />Member app</a>
          </header>
          <main className="m3a-content">{children}</main>
        </div>

        <nav className="m3a-bottom" aria-label="Admin">
          {ADMIN_PAGES.filter((p) => BAR.includes(p.id)).map((p) => (
            <Link key={p.id} href={p.href} className="m3a-tab" aria-current={active === p.id ? "page" : undefined}>
              <span className="m3a-pill"><p.icon size={22} strokeWidth={1.8} aria-hidden="true" />{badge(p.id) > 0 && <span className="m3a-badge" aria-hidden="true">{badge(p.id)}</span>}</span>
              <span>{p.label}{badge(p.id) > 0 && <span className="vh">, {badge(p.id)} new</span>}</span>
            </Link>
          ))}
          <button type="button" className="m3a-tab" aria-haspopup="dialog" aria-expanded={more} aria-current={active && MORE.includes(active) ? "page" : undefined} onClick={() => setMore(true)}>
            <span className="m3a-pill"><Ellipsis size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <span>More</span>
          </button>
        </nav>

        <Sheet open={more} onClose={() => setMore(false)} label="More">
          <h2 className="m3-title" style={{ padding: "0 4px" }}>More</h2>
          <div style={{ display: "flex", flexDirection: "column", margin: "0 -20px" }}>
            {ADMIN_PAGES.filter((p) => MORE.includes(p.id)).map((p) => (
              <Link key={p.id} href={p.href} className="m3a-li" style={{ padding: "8px 24px" }} aria-current={active === p.id ? "page" : undefined} onClick={() => setMore(false)}>
                <span className="m3-icon m3-tone-neutral" aria-hidden="true"><p.icon size={20} strokeWidth={1.9} /></span>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontWeight: 600 }}>{p.label}</span><span className="m3-small">{p.sub}</span></span>
              </Link>
            ))}
            <div style={{ height: 1, background: "#DFE3E8", margin: "8px 24px" }} />
            <a href="/" className="m3a-li" style={{ padding: "8px 24px", color: "var(--m3-primary)", fontWeight: 600 }}>
              <span className="m3-icon m3-tone-secondary" aria-hidden="true"><ExternalLink size={20} strokeWidth={1.9} /></span>
              <span style={{ flex: 1 }}>Open the member app</span>
            </a>
          </div>
        </Sheet>
    </SnackProvider>
      </div>
    </MeContext.Provider>
  );
}
