"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Cloud, Flame, IdCard, LogOut, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { getJSON, readError, send } from "@/lib/fetcher";
import type { WorkspaceData } from "@/lib/workspace";
import { WorkspacePass } from "./pass";
import { ProfileEditor } from "./profile";
import { Pantry } from "./pantry";
import { OfficeArena } from "./arena";
import { WorkspaceEvents } from "./events";
import { WorkspacePlanner } from "./planner";
import { WorkspaceSteps } from "./steps";
import { PaperNotes } from "./notes";
import { NoticeBoard } from "./notice-board";
import { LeaveChips } from "./leave-chips";
import { PhoneWorkspace } from "./phone";
import { useMobileViewport } from "@/lib/hooks/use-mobile-viewport";

export type WorkspaceView = "overview" | "steps" | "planner";
export function WorkspacePortal({ initial, view = "overview" }: { initial: WorkspaceData; view?: WorkspaceView }) {
  const [flipToken, setFlipToken] = useState(0);
  const [data, setData] = useState(initial);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState<boolean | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const keyboardOpen = useMobileViewport(phone === true);
  const reload = useCallback(async () => { const d = await getJSON<WorkspaceData>("/api/workspace", "your workspace", { fresh: true }); if (d) setData(d); }, []);
  useEffect(() => {
    const refreshWhenIdle = () => {
      if (document.visibilityState !== "visible" || document.querySelector('[role="dialog"]') ||
          document.activeElement?.matches("input,textarea,select,[contenteditable=true]")) return;
      void reload();
    };
    const timer = setInterval(refreshWhenIdle, 30000);
    document.addEventListener("visibilitychange", refreshWhenIdle);
    window.addEventListener("focus", refreshWhenIdle);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenIdle);
      window.removeEventListener("focus", refreshWhenIdle);
    };
  }, [reload]);
  useEffect(() => {
    const media = matchMedia("(max-width: 768px)");
    const update = () => setPhone(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  async function presence(mode: "office" | "remote" | "out") {
    if (busy) return; setBusy(true);
    const res = await send("/api/workspace", { method: "POST", json: { mode } });
    if (!res.ok) toast.error(await readError(res));
    else { await reload(); toast.success(mode === "out" ? "Checked out" : mode === "office" ? "You're in office" : "Remote for today"); }
    setBusy(false);
  }
  const presenceControl = <div className="workspace-presence-controls" aria-label="Your presence">
    <button aria-pressed={data.mode === "office"} disabled={busy} onClick={() => presence("office")}><Building2 size={12} />In office{data.mode === "office" && <Check size={11} />}</button>
    <button aria-pressed={data.mode === "remote"} disabled={busy} onClick={() => presence("remote")}><Cloud size={12} />Remote{data.mode === "remote" && <Check size={11} />}</button>
    {data.mode && <button aria-label="Check out" disabled={busy} onClick={() => presence("out")}><LogOut size={12} /></button>}
  </div>;
  const board = <NoticeBoard compact={!!phone} initial={data.notices} announcements={data.announcements} canModerate={data.canModerate} />;
  const pantry = <Pantry data={data} onSaved={reload} onOffice={() => presence("office")} />;
  const arena = <OfficeArena data={data} onSaved={reload} />;
  const events = <WorkspaceEvents initial={data.events} onSaved={reload} />;
  const steps = <WorkspaceSteps data={data} onSaved={reload} compact={!!phone} />;
  const planner = <WorkspacePlanner today={data.today} />;
  const p = data.profile;
  const phoneContent = <PhoneWorkspace data={data} view={view} presence={presenceControl} pantry={pantry} arena={arena} events={events} board={board} steps={steps} planner={planner} onProfile={() => setProfileOpen(true)} onComposeNote={() => setNoteOpen(true)} keyboardOpen={keyboardOpen} />;
  return <div className={`studio-workspace zip-workspace ${phone ? "is-phone" : ""}`}>
    <h1 className="sr-only">{view === "overview" ? "Your workspace" : view === "steps" ? "A little healthy competition" : "Your days, your rhythm"}</h1>
    {phone === null ? <div role="status" className="workspace-loading">Loading your workspace…</div> : phone ? phoneContent : view === "overview" ? <div className="dashboard-grid">
      <div className="dash-col dash-col-personal">
        <section className="widget-card id-card-widget">
          <div className="widget-header"><div className="widget-title-group"><span className="widget-icon-pill"><IdCard size={16} /></span><h2 className="widget-title">Digital Innovin ID Pass</h2></div><div className="card-controls"><button className="btn-icon-tiny" aria-label="Flip ID card" onClick={() => setFlipToken(t => t + 1)}><RotateCw size={13} />Flip</button><a className="btn-icon-tiny" href="/api/auth/google?next=/"><LogOut size={13} />Switch</a></div></div>
          <WorkspacePass name={data.user.name} designation={p?.designation} department={p?.department} desk={p?.desk} mode={data.mode} joined flipToken={flipToken} />
          {presenceControl}
          <div className="card-quick-actions"><button className="action-pill-btn" onClick={() => { navigator.clipboard.writeText(data.user.email).then(() => toast.success("Work email copied"), () => toast.error("Couldn't copy your email")); }}>Copy ID</button><button className="action-pill-btn" onClick={() => setProfileOpen(true)}>Edit profile</button><Link className="action-pill-btn" href="/attendance">Attendance log</Link></div>
          <LeaveChips />
        </section>
      </div>
      <div className="dash-col dash-col-middle dash-col-team">{arena}{board}</div>
      <div className="dash-col dash-col-activity">
        <section className="widget-card quick-steps-banner"><div className="quick-steps-left"><div className="steps-fire-badge"><Flame size={18} /></div><div className="steps-text-wrap"><h4>Steps: <span className="highlight-steps">{(data.steps.me?.today?.steps ?? 0).toLocaleString()}</span> <span className="goal-dim">/ {data.steps.goal.toLocaleString()}</span></h4><p>{data.prize || `${Math.max(0, data.steps.goal - (data.steps.me?.today?.steps ?? 0)).toLocaleString()} steps to your daily goal`}</p></div></div><Link className="primary-btn btn-sm btn-jump-to-steps" href="/steps" aria-label="View Steps Leaderboard">Ranks →</Link></section>
        {pantry}{events}
      </div>
    </div> : view === "steps" ? steps : planner}
    <PaperNotes people={data.people} email={data.user.email} open={noteOpen} onOpenChange={setNoteOpen} floatingTrigger={phone === false} onSaved={reload} />
    {profileOpen && <ProfileEditor profile={p} onClose={() => setProfileOpen(false)} onSaved={reload} />}
  </div>;
}
