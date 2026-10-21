"use client";
import { useRef, useState } from "react";
import { List, Minus, MousePointer2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { readError, send } from "@/lib/fetcher";
import type { WorkspaceData } from "@/lib/workspace";

export function OfficeArena({ data, onSaved }: { data: WorkspaceData; onSaved: () => Promise<void> }) {
  const [mode, setMode] = useState("all");
  const [zoom, setZoom] = useState(.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [focus, setFocus] = useState("");
  const [list, setList] = useState(false);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const people = data.people.filter(p => mode === "all" || p.mode === mode);
  const projects = [...new Set(people.map(p => p.project || "Shared studio"))];
  async function status(text: string) {
    if (busy || !text.trim()) return;
    setBusy(true);
    const res = await send("/api/workspace", { method: "PATCH", json: { focus: text.trim() } });
    if (!res.ok) toast.error(await readError(res)); else { setFocus(""); await onSaved(); toast.success("Your status is shared with the team"); }
    setBusy(false);
  }
  return <section className="widget-card people-widget figma-people-widget reference-arena">
    <div className="people-widget-header"><div className="people-header-row-main"><div className="widget-title-group"><span className="widget-icon-pill emerald"><Users size={15} /></span><div className="people-title-wrap"><h2 className="widget-title people-header-title">People in Office</h2><span className="widget-sub people-header-sub"><span className="live-pulse-dot" /><strong>{data.people.filter(p => p.mode === "office").length}</strong> present</span></div></div><div className="figma-view-toggle mini-toggle"><button className={`view-toggle-btn ${!list ? "active" : ""}`} aria-pressed={!list} onClick={() => setList(false)}><MousePointer2 size={11} />Arena</button><button className={`view-toggle-btn ${list ? "active" : ""}`} aria-pressed={list} onClick={() => setList(true)}><List size={11} />List</button></div></div>
      <div className="people-status-segmented-bar">{[["office", "Office"], ["remote", "Remote / WFH"], ["all", "All"]].map(([key, label]) => <button key={key} className={`pill-btn ${mode === key ? "active" : ""}`} aria-pressed={mode === key} onClick={() => setMode(key)}><span className={`status-indicator-dot ${key}`} />{label}<span className="status-num-pill">{data.people.filter(p => key === "all" || p.mode === key).length}</span></button>)}</div>
    </div>
    {list ? <div className="people-list-container reference-people-list">{people.map(p => <div key={p.email}><strong>{p.name}</strong><span>{p.designation || "Workspace member"} · {p.mode === "office" ? "In office" : p.mode === "remote" ? "Remote" : "Not checked in"}</span>{p.focus && <span>{p.focus}</span>}</div>)}{!people.length && <p className="arena-empty">No teammates in this view yet.</p>}</div> : <div className="figma-canvas-box" onPointerDown={e => { if ((e.target as HTMLElement).closest("button,input,select,a")) return; drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="arena-zoom-controls"><button className="btn-arena-circle-zoom" aria-label="Zoom out arena" onClick={() => setZoom(z => Math.max(.3, z - .1))}><Minus size={16} /></button><span className="zoom-level-pill sr-only">{Math.round(zoom * 100)}%</span><button className="btn-arena-circle-zoom is-muted" aria-label="Zoom in arena" onClick={() => setZoom(z => Math.min(1.5, z + .1))}><Plus size={16} /></button></div>
      <div className="arena-center-project-label">{data.profile?.project || "Innovin"}</div>
      <div className="arena-live-world" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
        {zoom < .6 ? projects.map((project, i) => <button key={project} className="project-bubble-node" style={{ left: 20 + i % 2 * 140, top: 50 + Math.floor(i / 2) * 80 }} onClick={() => { setZoom(.85); setPan({ x: 0, y: 0 }); }}><span className="project-bubble-dot" style={{ background: "#2563eb" }} />{project}</button>) : people.map((p, i) => <button key={p.email} className="figma-cursor-item" style={{ left: 15 + i % 2 * 145, top: 25 + Math.floor(i / 2) * 70, color: ["#e11d48", "#9333ea", "#0891b2", "#2563eb"][i % 4] }} aria-label={`Wave to ${p.name}`} disabled={p.email === data.user.email || busy} onClick={async () => { setBusy(true); const res = await send("/api/pings", { method: "POST", json: { to: p.email, body: "👋 Hi!" } }); if (!res.ok) toast.error(await readError(res)); else toast.success(`Waved to ${p.name}`); setBusy(false); }}><svg className="cursor-pointer-svg" width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M1 1L7.5 20.5L10.5 12.5L17 9.5L1 1Z" fill="currentColor" stroke="white" /></svg><span className="cursor-pill" style={{ background: "currentColor" }}><span className="cursor-person-name">{p.name}{p.email === data.user.email ? " (you)" : ""}</span></span>{p.focus && <span className="arena-focus-bubble">{p.focus}</span>}</button>)}
      </div>
      {!people.length && <p className="arena-empty">No teammates in this view yet.</p>}
      <form className="figma-canvas-toolbar" onSubmit={e => { e.preventDefault(); status(focus); }}><div className="figma-chat-input-wrap"><span className="figma-chat-key">💬</span><input aria-label="Your office status" value={focus} maxLength={36} onChange={e => setFocus(e.target.value)} placeholder="Broadcast status…" /><button className="btn-figma-send-chat" disabled={busy || !focus.trim()}>Broadcast</button></div><div className="figma-quick-reactions">{["👋", "☕", "🚀", "🎧"].map(emoji => <button key={emoji} type="button" className="quick-rx-btn" aria-label={`Share status ${emoji}`} disabled={busy} onClick={() => status(emoji)}>{emoji}</button>)}</div></form>
    </div>}
  </section>;
}
