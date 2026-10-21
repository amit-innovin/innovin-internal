"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Expand, Footprints, House, Pin, RotateCw, Settings, UserRound, X } from "lucide-react";
import type { WorkspaceData } from "@/lib/workspace";
import type { WorkspaceView } from "./portal";
import { WorkspacePlanner } from "./planner";
import Notifications from "@/components/notifications";

type Props = { data: WorkspaceData; view: WorkspaceView; presence: ReactNode; pantry: ReactNode; arena: ReactNode; events: ReactNode; board: ReactNode; steps: ReactNode; planner: ReactNode; onProfile: () => void };
export function PhoneWorkspace({ data, view, presence, pantry, arena, events, board, steps, planner, onProfile }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [notice, setNotice] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = document.documentElement;
        root.style.setProperty("--workspace-viewport-height", `${viewport.height}px`);
        root.style.setProperty("--workspace-viewport-top", `${viewport.offsetTop}px`);
        const editing = document.activeElement?.matches("input,textarea,select");
        setKeyboardOpen(!!editing && innerHeight - viewport.height > 120);
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.documentElement.style.removeProperty("--workspace-viewport-height");
      document.documentElement.style.removeProperty("--workspace-viewport-top");
    };
  }, []);
  useEffect(() => setNotice(false), [view]);
  return <div className="phone-touchpoint-wrapper" data-keyboard-open={keyboardOpen || undefined}><div className="phone-touchpoint-container">
    <div className="phone-dynamic-island" aria-hidden="true"><span className="island-camera" /><span className="island-sensor" /></div>
    <div className="phone-page-header"><div className="phone-heading-row"><h2 className="phone-brand-title">{notice ? "Notice Board" : view === "steps" ? "Activity & Steps" : view === "planner" ? "Your Planner" : "Innovin internal"}</h2><div className="phone-account-tools"><button aria-label="Edit profile" onClick={onProfile}><UserRound size={18} /></button><Notifications /><Link href="/planner" aria-label="Leave & WFH Planner" aria-current={view === "planner" ? "page" : undefined}><CalendarDays size={18} /></Link><Link href="/settings" aria-label="Settings"><Settings size={18} /></Link></div></div><span className="phone-page-subtitle">{notice ? "Company memos, quotes & team feedback" : view === "steps" ? "Daily movement · The team challenge" : view === "planner" ? "Your days, your rhythm" : "Personal Workspace & Passes"}</span></div>
    {!notice && view === "overview" && <div className="phone-presence-bar">{presence}</div>}
    {notice ? <div className="phone-notice-body">{board}</div> : view === "steps" ? <div className="phone-steps-body">{steps}</div> : view === "planner" ? <div className="phone-planner-body">{planner}</div> : <div className={`phone-cards-stack ${expanded ? "has-expanded" : ""}`}>
      <section className={`phone-stack-card card-innovin-pass ${flipped ? "is-flipped is-expanded" : ""}`}>
        <div className="phone-id-card-flipper"><div className="phone-id-face phone-id-front" aria-hidden={flipped} inert={flipped}><div className="phone-id-top"><span className="phone-id-label">DIGITAL INNOVIN ID PASS</span><button className="phone-btn-flip-card" aria-label="Flip workspace pass" onClick={() => setFlipped(true)}><RotateCw size={18} /></button></div><div className="phone-id-person"><h2 className="phone-id-name" title={data.user.name}>{data.user.name}</h2><span className="phone-id-role" title={data.profile?.designation || "Workspace member"}>{data.profile?.designation || "Workspace member"}</span></div></div>
          <div className="phone-id-face phone-id-back" aria-hidden={!flipped} inert={!flipped}><div className="phone-cal-top"><span className="phone-cal-month-label">YOUR PERSONAL CALENDAR</span><button className="phone-cal-close-btn" aria-label="Close pass calendar" onClick={() => setFlipped(false)}><X size={18} /></button></div>{flipped && <WorkspacePlanner today={data.today} />}</div></div>
      </section>
      {[["pantry", "Pantry & Snacks Bar", "card-pantry-snacks", pantry, `${data.snacks.items.length} / 4 claimed today`], ["arena", "People in Office", "card-people-office", arena, `${data.people.filter(p => p.mode === "office").length} present`], ["events", "Today's Office Events", "card-office-events", events, `${data.events.length} upcoming`]].map(([key, title, className, content, subtitle]) => <section key={key as string} className={`phone-stack-card ${className} ${expanded === key ? "is-expanded" : ""}`}>
        <div className="phone-card-header-bar"><div className="phone-card-title-wrap"><h3 className="phone-card-title">{title}</h3><span className={key === "arena" ? "phone-live-pulse-badge" : key === "events" ? "phone-card-badge-violet" : "phone-card-badge-amber"}>{subtitle}</span></div><div className="phone-card-header-actions"><button className="phone-btn-expand" aria-label={`Expand ${key === "pantry" ? "Pantry" : key === "arena" ? "People in Office" : "Events"}`} aria-expanded={expanded === key} onClick={() => setExpanded(key as string)}><Expand size={18} /></button><button className="phone-btn-close-card" aria-label={`Close ${key}`} onClick={() => setExpanded(null)}><X size={18} /></button></div></div>
        <div className="phone-expanded-body">{expanded === key && content}</div>
      </section>)}
      <div className="phone-wallet-links"><a href="/api/auth/google?next=/">Switch account</a><Link href="/attendance">Attendance &amp; leave</Link><Link href="/people">Team directory</Link><Link href="/wifi">Wi-Fi pulse</Link><Link href="/grievances">Speak Up</Link><Link href="/help">Help</Link>{data.canModerate && <Link href="/admin">Admin</Link>}</div>
    </div>}
    <nav className="phone-bottom-dock" aria-label="Phone workspace navigation">
      <Link className={`phone-dock-item ${view === "overview" && !notice ? "active" : ""}`} href="/" aria-label="Overview" aria-current={view === "overview" && !notice ? "page" : undefined} onClick={() => setNotice(false)}><House size={23} /></Link>
      <Link className={`phone-dock-item ${view === "steps" && !notice ? "active" : ""}`} href="/steps" aria-label="Daily Steps & Prize" aria-current={view === "steps" && !notice ? "page" : undefined}><Footprints size={23} /></Link>
      <button className={`phone-dock-item ${notice ? "active" : ""}`} aria-label="Office Notice Board" aria-pressed={notice} onClick={() => setNotice(true)}><Pin size={23} /></button>
    </nav>
  </div></div>;
}
