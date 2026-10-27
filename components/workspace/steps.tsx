"use client";
import { useState,useEffect,useRef } from "react";
import { Footprints, Trophy } from "lucide-react";
import { toast } from "sonner";
import { readError, send } from "@/lib/fetcher";
import type { WorkspaceData } from "@/lib/workspace";

export function WorkspaceSteps({ data, onSaved, compact = false }: { data: WorkspaceData; onSaved: () => Promise<void>; compact?: boolean }) {
  const [ranking, setRanking] = useState<keyof WorkspaceData["rankings"]>("week");
  const [count, setCount] = useState(String(data.steps.me?.today?.steps ?? 0));
  const [busy, setBusy] = useState(false);
  const writing=useRef(false);
  const saved=data.steps.me?.today?.steps??0;
  useEffect(()=>{if(!writing.current)setCount(String(saved));},[saved]);
  const current = saved, goal = data.steps.goal;
  const dirty=Number(count)!==saved;
  const progress = Math.min(100, Math.max(0, current / goal * 100));
  async function save(value=Number(count), shortcut=false) {
    if(writing.current || !Number.isInteger(value) || value<0 || value>200000)return;
    writing.current=true;setBusy(true);
    const res = await send("/api/steps", { method: "POST", json: { steps: value } });
    if (!res.ok) { if(shortcut)setCount(String(saved));toast.error(await readError(res)); } else { setCount(String(value));await onSaved(); toast.success("Today's steps saved"); }
    writing.current=false;setBusy(false);
  }
  const form = <form className={compact ? "phone-step-form" : "custom-step-form"} onSubmit={e => { e.preventDefault(); save(); }}><label>Today&apos;s total steps<input type="number" required min={0} max={200000} step={1} disabled={busy} value={count} onChange={e => setCount(e.target.value)} /></label><button className={compact ? "phone-btn-log-steps" : "studio-button"} disabled={busy}>{busy ? "Saving…" : dirty ? "Save unsaved steps" : "Save today's steps"}</button></form>;
  const tabs = <div className="leaderboard-tabs ranking-tabs">{([["week", "Most steps"], ["days", "10k+ days"], ["record", "Single-day best"], ["departments", "Department battle"]] as const).map(([key, title]) => <button key={key} className={`lb-tab ${ranking === key ? "active" : ""}`} aria-pressed={ranking === key} onClick={() => setRanking(key)}>{title}</button>)}</div>;
  const ranks = <div className="ranking-list">{data.rankings[ranking].length ? data.rankings[ranking].map((r, i) => <div key={r.id} className={`${compact ? "preview-row" : "lb-row-card"} ${r.id === data.user.email ? "is-me active" : ""}`}><span className="ranking-position">{i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1).padStart(2, "0")}</span>{!compact && <span className="ranking-avatar">{r.name[0]}</span>}<div><strong>{r.name}{r.id === data.user.email ? " (you)" : ""}</strong><small>{r.unit}</small></div><b>{r.score.toLocaleString()}</b></div>) : <div className="studio-empty"><Footprints size={30} /><h3>The first step is yours.</h3><p>Log a count to start the board.</p></div>}</div>;
  const caption = <p className="ranking-caption">{ranking === "week" ? "This week · Monday to today · recorded counts only" : ranking === "departments" ? "This week's average per teammate who logged a count" : ranking === "days" ? "Qualifying days · includes admin-entered sheet totals when available" : "Best single-day count logged in this app"}</p>;
  if (compact) return <>
    <section className="phone-steps-circle-card"><div className="steps-icon-badge">👟</div><div className="steps-val-big">{Number.isFinite(current) ? current.toLocaleString() : "—"}</div><span className="steps-goal-sub">of {goal.toLocaleString()} steps daily goal</span><div className="phone-steps-bar-wrapper"><div className="phone-steps-bar-fill" style={{ width: `${progress}%` }} /></div><div className="steps-badges-row"><span className="steps-progress-pill">🔥 {data.steps.me?.streak ?? 0} Day Active Streak</span><span className="steps-progress-pill cal-pill">⚡ {data.steps.me?.days ?? 0} qualifying days</span></div>{form}<button className="phone-quick-walk" disabled={busy} onClick={() => save(Math.min(200000,(Number(count)||0)+500),true)}>+ Log 500 Steps</button></section>
    {data.prize && <section className="phone-mystery-box-card"><span className="mystery-box-icon">🎁</span><div className="mystery-box-info"><strong>{data.prize}</strong><p>Keep building your daily walking habit.</p></div></section>}
    <section className="phone-leaderboard-preview"><h2 className="preview-title">Top Walkers This Week</h2>{tabs}{caption}{ranks}</section>
  </>;
  return <><section className="mystery-prize-banner"><div className="prize-glow" /><div className="prize-box-visual"><div className="glowing-gift-cube"><div className="cube-ribbon" /><div className="cube-sparkles">✨</div></div></div><div className="prize-details"><div className="prize-badge-row"><span className="prize-tag">INNOVIN WALKING CHALLENGE</span></div><h2 className="prize-title">{data.prize || "Innovin Daily Steps Challenge"}</h2><p className="prize-desc">Build your daily walking habit. Log your steps, reach {goal.toLocaleString()}, and see how the team is doing.</p><div className="prize-progress-track"><div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div><span className="progress-label">{Math.round(progress)}% of today&apos;s goal</span></div></div><div className="prize-action"><button className="glow-btn" onClick={() => document.querySelector<HTMLInputElement>('.custom-step-form input')?.focus()}>Enter today's steps</button></div></section>
    <div className="steps-layout-grid zip-steps-grid"><section className="widget-card step-logger-card"><div className="widget-header"><div className="widget-title-group"><span className="widget-icon-pill cyan"><Footprints size={16} /></span><h2 className="widget-title">Your Step Counter</h2></div></div><div className="step-dial-container"><div className="circular-progress"><svg viewBox="0 0 160 160" className="progress-ring"><circle className="ring-bg" cx="80" cy="80" r="68" /><circle className="ring-fill" cx="80" cy="80" r="68" strokeDasharray="427" strokeDashoffset={427 * (1 - progress / 100)} /></svg><div className="dial-center-content"><span className="dial-count">{Number.isFinite(current) ? current.toLocaleString() : "—"}</span><span className="dial-unit">Steps Today</span><span className="dial-percent">{Math.round(progress)}% of Goal</span></div></div></div><div className="quick-add-steps-row">{[[500, "+500 (Quick Walk)"], [1500, "+1.5k (Lunch Walk)"], [3000, "+3k (Stairs/Jog)"]].map(([n, label]) => <button key={n} className="quick-step-btn" disabled={busy} onClick={() => save(Math.min(200000,(Number(count)||0)+Number(n)),true)}>{label}</button>)}</div>{form}<div className="daily-streak-card"><span className="streak-icon">🔥</span><div className="streak-details"><strong>{data.steps.me?.streak ?? 0}-Day Active Streak</strong><span>{data.steps.me?.days ?? 0} qualifying days logged</span></div></div><small className="manual-step-note">{dirty?"Unsaved input · press Save to update your total":"Manual logs · today only"} · goal: {goal.toLocaleString()}</small></section>
      <section className="widget-card leaderboard-card"><div className="widget-header"><div className="widget-title-group"><span className="widget-icon-pill amber"><Trophy size={16} /></span><h2 className="widget-title">Innovin Fitness Arena</h2></div></div>{tabs}{caption}{ranks}</section>
    </div>
  </>;
}
