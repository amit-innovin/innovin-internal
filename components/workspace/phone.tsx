"use client";
import Link from "next/link";
import { useRouter, useSearchParams,usePathname } from "next/navigation";
import AttendanceCalendar from "@/components/attendance-calendar";
import { boardHref } from "@/lib/journey";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Expand, Footprints, House, Pin, RotateCw, Settings, UserRound, X } from "lucide-react";
import type { WorkspaceData } from "@/lib/workspace";
import type { WorkspaceView } from "./portal";
import Notifications from "@/components/notifications";

type Props = { data: WorkspaceData; view: WorkspaceView; presence: ReactNode; arena: ReactNode; events: ReactNode; board: ReactNode; steps: ReactNode; onProfile: () => void; keyboardOpen: boolean };
export function PhoneWorkspace({ data, view, presence, arena, events, board, steps, onProfile, keyboardOpen }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const router=useRouter();
  const params=useSearchParams();
  const pathname=usePathname();
  const notice=params.get("view")==="board";
  const cardId = useId();
  const expandButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  function closeCard(key: string) {
    setExpanded(null);
    requestAnimationFrame(() => expandButtons.current[key]?.focus({ preventScroll: true }));
  }

  return <div className="phone-touchpoint-wrapper phone-workspace-polished" data-keyboard-open={keyboardOpen || undefined}><div className="phone-touchpoint-container">
    <div className="phone-page-header"><div className="phone-heading-row"><h2 className="phone-brand-title">{notice ? "Notice Board" : view === "steps" ? "Activity & Steps" : "Innovin internal"}</h2><div className="phone-account-tools"><button aria-label="Edit profile" onClick={onProfile}><UserRound size={18} /></button><Notifications /><Link href="/attendance?tab=leave" aria-label="Attendance & Leave"><CalendarDays size={18} /></Link><Link href="/settings" aria-label="Settings"><Settings size={18} /></Link></div></div><span className="phone-page-subtitle">{notice ? "Company memos, quotes & team feedback" : view === "steps" ? "Daily movement · The team challenge" : "Personal Workspace & Passes"}</span></div>
    {!notice && view === "overview" && <div className="phone-presence-bar">{presence}</div>}
    {notice ? <div className="phone-notice-body">{board}</div> : view === "steps" ? <div className="phone-steps-body">{steps}</div> : <div className={`phone-cards-stack ${expanded ? "has-expanded" : ""}`}>
      <section className={`phone-stack-card card-innovin-pass ${flipped ? "is-flipped is-expanded" : ""}`}>
        <div className="phone-id-card-flipper"><div className="phone-id-face phone-id-front" aria-hidden={flipped} inert={flipped}><div className="phone-id-top"><span className="phone-id-label">DIGITAL INNOVIN ID PASS</span><button className="phone-btn-flip-card" aria-label="Flip workspace pass" onClick={() => setFlipped(true)}><RotateCw size={18} /></button></div><div className="phone-id-person"><h2 className="phone-id-name" title={data.user.name}>{data.user.name}</h2><span className="phone-id-role" title={data.profile?.designation || "Workspace member"}>{data.profile?.designation || "Workspace member"}</span></div></div>
          <div className="phone-id-face phone-id-back" aria-hidden={!flipped} inert={!flipped}><div className="phone-cal-top"><span className="phone-cal-month-label">YOUR ATTENDANCE CALENDAR</span><button className="phone-cal-close-btn" aria-label="Close pass calendar" onClick={() => setFlipped(false)}><X size={18} /></button></div>{flipped && <AttendanceCalendar navigate={false} />}</div></div>
      </section>
      {[["arena", "People in Office", "card-people-office", arena, `${data.people.filter(p => p.mode === "office").length} present`], ["events", "Upcoming Office Events", "card-office-events", events, `${data.events.length} upcoming`]].map(([key, title, className, content, subtitle]) => <section key={key as string} className={`phone-stack-card ${className} ${expanded === key ? "is-expanded" : ""}`}>
        <div className="phone-card-header-bar"><div className="phone-card-title-wrap"><h3 className="phone-card-title">{title}</h3><span className={key === "arena" ? "phone-live-pulse-badge" : key === "events" ? "phone-card-badge-violet" : "phone-card-badge-amber"}>{subtitle}</span></div><div className="phone-card-header-actions">{<><button className="phone-btn-expand" aria-label={`Expand ${key === "arena" ? "People in Office" : "Events"}`} aria-expanded={expanded === key} aria-controls={`${cardId}-${key}`} ref={button => { expandButtons.current[key as string] = button; }} onClick={() => setExpanded(key as string)}><Expand size={18} /></button><button className="phone-btn-close-card" aria-label={`Close ${key}`} onClick={() => closeCard(key as string)}><X size={18} /></button></>}</div></div>
        <div className="phone-expanded-body" id={`${cardId}-${key}`} role="region" aria-label={title as string}>{expanded === key && content}</div>
      </section>)}
      <div className="phone-wallet-links"><a href={`/api/auth/google?next=${encodeURIComponent(pathname+(params.size?`?${params}`:""))}`}>Switch account</a><Link href="/attendance">Attendance &amp; leave</Link><Link href="/wifi?check=1">Wi-Fi pulse</Link><Link href="/grievances">Speak Up</Link><Link href="/help">Help</Link>{data.canModerate && <Link href="/admin">Admin</Link>}</div>
    </div>}
    <nav className="phone-bottom-dock" aria-label="Phone workspace navigation">
      <Link className={`phone-dock-item ${view === "overview" && !notice ? "active" : ""}`} href="/" aria-label="Overview" aria-current={view === "overview" && !notice ? "page" : undefined} ><House size={22} /><span>Home</span></Link>
      <Link className={`phone-dock-item ${view === "steps" && !notice ? "active" : ""}`} href="/steps" aria-label="Daily Steps" aria-current={view === "steps" && !notice ? "page" : undefined}><Footprints size={22} /><span>Steps</span></Link>
      <button className={`phone-dock-item ${notice ? "active" : ""}`} aria-label="Office Notice Board" aria-pressed={notice} onClick={() => router.push(boardHref())}><Pin size={22} /><span>Board</span></button>
    </nav>
  </div></div>;
}
