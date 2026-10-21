"use client";
import { useEffect, useId, useRef, useState } from "react";
import { mountLanyard } from "@/lib/lanyard";
import { getJSON } from "@/lib/fetcher";
import type { PlannerDay } from "@/lib/types";
import { PLANNER_ICONS } from "@/lib/workspace-model";
export function WorkspacePass({ name = "Innovin Team", designation, department, desk, mode, joined = false, flipToken = 0 }: { name?: string; designation?: string; department?: string; desk?: string; mode?: "office" | "remote" | null; joined?: boolean; flipToken?: number }) {
 const [flipped,setFlipped]=useState(false), [tilt,setTilt]=useState(0);
 const stageRef=useRef<HTMLDivElement>(null), badgeRef=useRef<HTMLDivElement>(null), canvasRef=useRef<HTMLCanvasElement>(null);
 const flipRef=useRef(flipped); flipRef.current=flipped;
 const physics=useRef<ReturnType<typeof mountLanyard> | null>(null);
 useEffect(()=>{if(!joined||!stageRef.current||!badgeRef.current||!canvasRef.current)return; const mounted=mountLanyard(stageRef.current,badgeRef.current,canvasRef.current,()=>flipRef.current,()=>setFlipped(f=>!f));physics.current=mounted;return()=>{mounted.dispose();physics.current=null;};},[joined]);
 useEffect(()=>{physics.current?.sync();},[flipped]);
 const [first,...parts]=name.split(" "); const last=parts.join(" ") || "Team";
 const filterId=useId(); const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7)); const [plans,setPlans]=useState<PlannerDay[]>([]);
 const year=Number(month.slice(0,4)), mon=Number(month.slice(5)); const monthDays=new Date(Date.UTC(year,mon,0)).getUTCDate(); const monthOffset=new Date(Date.UTC(year,mon-1,1)).getUTCDay(); const monthLabel=new Intl.DateTimeFormat("en",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T00:00:00Z`)).toUpperCase();
 useEffect(()=>{if(flipToken) setFlipped(f=>!f);},[flipToken]);
 useEffect(()=>{if(!joined||!flipped)return;let active=true;getJSON<PlannerDay[]>(`/api/planner?from=${month}-01&to=${month}-${monthDays}`,"your pass calendar",{fresh:true}).then(p=>{if(p&&active)setPlans(p);});return()=>{active=false;};},[joined,flipped,month,monthDays]);
 function shift(n:number){setMonth(new Date(Date.UTC(year,mon-1+n,1)).toISOString().slice(0,7));}

 return <div ref={stageRef} className={`reference-pass-stage ${joined ? "physics-pass-stage" : "preview-pass-stage"}`} onPointerMove={(e)=>{ if(!joined&&e.pointerType!=="touch") {const r=e.currentTarget.getBoundingClientRect();setTilt((e.clientX-r.left-r.width/2)/40);}}} onPointerLeave={()=>setTilt(0)}>
{joined && <canvas ref={canvasRef} className="lanyard-physics-canvas" aria-hidden="true" />}
<div className="lanyard-stage-box main-lanyard-box">

<div className={`lanyard-strap-anchor ${joined ? "reference-hide" : ""}`}>
<svg className="lanyard-svg" viewBox="0 0 280 180" fill="none">
<defs>
<filter id={filterId} x="-10%" y="-10%" width="130%" height="130%">
<feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.45"></feDropShadow>
</filter>
</defs>

<path d="M 30 -20 Q 120 100 140 145" stroke="#161b24" strokeWidth="12" strokeLinecap="round" filter={`url(#${filterId})`}></path>
<path d="M 30 -20 Q 120 100 140 145" stroke="#252e3d" strokeWidth="10" strokeLinecap="round"></path>
<path d="M 30 -20 Q 120 100 140 145" stroke="#475569" strokeWidth="1.5" strokeDasharray="2 3"></path>

<path d="M 250 -20 Q 160 100 140 145" stroke="#10141c" strokeWidth="12" strokeLinecap="round" filter={`url(#${filterId})`}></path>
<path d="M 250 -20 Q 160 100 140 145" stroke="#1e2634" strokeWidth="10" strokeLinecap="round"></path>
<path d="M 250 -20 Q 160 100 140 145" stroke="#475569" strokeWidth="1.5" strokeDasharray="2 3"></path>
</svg>

<div className="swivel-metal-clasp">
<div className="clasp-metal-band"></div>
<div className="clasp-metal-swivel"></div>
<div className="clasp-lobster-hook">
<svg width="22" height="38" viewBox="0 0 22 38" fill="none">
<path d="M 7 2 C 7 0 15 0 15 2 L 15 8 L 7 8 Z" fill="#cbd5e1"></path>
<path d="M 11 8 L 11 14" stroke="#94a3b8" strokeWidth="4"></path>
<path d="M 8 14 C 4 18 3 26 10 33 C 13 36 17 34 17 30 C 17 24 14 20 13 16 Z" fill="#e2e8f0"></path>
<path d="M 8 14 C 4 18 3 26 10 33 C 13 36 17 34 17 30 C 17 24 14 20 13 16 Z" stroke="#64748b" strokeWidth="1.5"></path>
<path d="M 14 18 L 14 28" stroke="#334155" strokeWidth="2" strokeLinecap="round"></path>
</svg>
</div>
</div>
</div>

<div ref={badgeRef} className={`clear-badge-holder interactive-card-badge ${flipped ? "flipped" : ""}`} style={joined ? undefined : {transform: `rotate(${tilt - 3}deg)`}}>

<div className="pvc-punch-bar">
<span className="pvc-eyelet left"></span>
<div className="pvc-slot-hole center">
<span className="clasp-through-shadow"></span>
</div>
<span className="pvc-eyelet right"></span>
<div className="pvc-ziplock-line"></div>
</div>

<div className="pvc-card-pocket">
<div className="pvc-glass-highlight"></div>

<div className="card-faces-3d-wrap">

<div className="paper-card-insert face-front" aria-hidden={flipped} inert={flipped}>
<div className="card-brand-header">
<div className="brand-crest">
<span className="crest-dot"></span>
<span className="crest-text">{"INNOVIN PASS"}</span>
</div>
<span className="pass-code-mono">{joined ? "WORKSPACE" : "YOUR PASS"}</span>
</div>

<div className="editorial-name-block">
<div className="name-first">{first}</div>
<div className="name-last">{last}</div>
</div>

<div className="card-editorial-body">
<div className="editorial-row">
<span className="editorial-label">{"Currently"}</span>
<div className="editorial-value">{designation || "Workspace member"}</div>
</div>
<div className="editorial-row">
<span className="editorial-label">{"Previously"}</span>
<div className="editorial-pills-wrap">
<span className="editorial-pill pill-dark">{department || "Innovin"}</span>
<span className="editorial-pill pill-red">{desk || "Innovin team"}</span>
</div>
</div>
<div className="editorial-row">
<span className="editorial-label">{"Status"}</span>
<div className="editorial-pills-wrap">
<span className="editorial-pill pill-presence in-office"><span className="dot" /><span className="text">{mode === "office" ? "IN OFFICE" : mode === "remote" ? "REMOTE / WFH" : "NOT CHECKED IN"}</span></span>
<span className="editorial-pill pill-level">MEMBER</span>
</div>
</div>
</div>
<div className="card-editorial-footer">
<div className="mini-barcode-graphic"></div>
<span className="serial-footnote">WORKSPACE PROFILE</span>
</div>
</div>

<div className="paper-card-insert face-back" aria-hidden={!flipped} inert={!flipped}>

<div className="card-back-header">
<div className="card-back-branding">
<span className="back-crest-dot"></span>
<span className="back-brand-title">{"ATTENDANCE LOG"}</span>
</div>
<div className="card-back-month-nav">
<button className="card-back-nav-btn" title="Previous Month" type="button" aria-label="Previous Month" onClick={()=>shift(-1)}>{"\u2039"}</button>
<span className="card-back-month-title">{monthLabel}</span>
<button className="card-back-nav-btn" title="Next Month" type="button" aria-label="Next Month" onClick={()=>shift(1)}>{"\u203a"}</button>
</div>
</div>

<div className="card-back-summary-strip">
<div className="cb-chip chip-office" title="Present in Office">
<span className="cb-chip-dot"></span>
<span className="cb-chip-count">{joined ? plans.filter(p=>p.kind==="office").length : "—"}</span>
<span className="cb-chip-lbl">{"Office"}</span>
</div>
<div className="cb-chip chip-wfh" title="Work From Home">
<span className="cb-chip-dot"></span>
<span className="cb-chip-count">{joined ? plans.filter(p=>p.kind==="remote").length : "—"}</span>
<span className="cb-chip-lbl">{"WFH"}</span>
</div>
<div className="cb-chip chip-casual" title="Casual Leave">
<span className="cb-chip-dot"></span>
<span className="cb-chip-count">{joined ? plans.filter(p=>p.kind==="vacation").length : "—"}</span>
<span className="cb-chip-lbl">{"Casual"}</span>
</div>
<div className="cb-chip chip-sick" title="Sick Leave">
<span className="cb-chip-dot"></span>
<span className="cb-chip-count">{joined ? plans.filter(p=>p.kind==="sick").length : "—"}</span>
<span className="cb-chip-lbl">{"Sick"}</span>
</div>
<div className="cb-chip chip-festival" title="Festival Leave">
<span className="cb-chip-dot"></span>
<span className="cb-chip-count">{joined ? plans.filter(p=>p.kind==="festival").length : "—"}</span>
<span className="cb-chip-lbl">{"Festive"}</span>
</div>
<div className="cb-chip chip-holiday" title="Public Holiday">
<span className="cb-chip-dot"></span>
<span className="cb-chip-count">{joined ? plans.filter(p=>p.kind==="holiday").length : "—"}</span>
<span className="cb-chip-lbl">{"Holiday"}</span>
</div>
</div>

<div className="card-back-cal-weekdays">
<span>{"S"}</span>
<span>{"M"}</span>
<span>{"T"}</span>
<span>{"W"}</span>
<span>{"T"}</span>
<span>{"F"}</span>
<span>{"S"}</span>
</div>

<div className="card-back-cal-grid">{Array.from({ length: monthOffset }, (_, i) => <span key={`e-${i}`} />)}{Array.from({ length: monthDays }, (_, i) => <a key={i} href="/planner" className="card-cal-day" aria-label={`Plan day ${i + 1}`}>{i + 1}{plans.find(p=>p.date===`${month}-${String(i+1).padStart(2,"0")}`)?.kind ? <small>{PLANNER_ICONS[plans.find(p=>p.date===`${month}-${String(i+1).padStart(2,"0")}`)!.kind]}</small> : null}</a>)}</div>

<div className="card-back-day-status">
<span className="status-indicator-dot"></span>
<span className="status-indicator-text">Personal plans · open planner to edit</span>
</div>

<div className="card-back-footer">
<div className="card-back-legend">
<span className="legend-tag tag-office"><i className="dot"></i>{"Office"}</span>
<span className="legend-tag tag-wfh"><i className="dot"></i>{"WFH"}</span>
<span className="legend-tag tag-casual"><i className="dot"></i>{"Casual"}</span>
<span className="legend-tag tag-sick"><i className="dot"></i>{"Sick"}</span>
<span className="legend-tag tag-festival"><i className="dot"></i>{"Festive"}</span>
<span className="legend-tag tag-holiday"><i className="dot"></i>{"Holiday"}</span>
</div>
<div className="card-back-meta">
<span className="meta-crypto-id">PERSONAL PLANNER</span>
<button className="btn-flip-back-card" type="button" title="Flip to front face" onClick={() => setFlipped(false)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
<span>{"Front"}</span>
</button>
</div>
</div>
</div>
</div>
</div>
</div>
</div><button type="button" className="btn-icon-tiny reference-flip" aria-label="Flip workspace pass" aria-pressed={flipped} onClick={()=>setFlipped(!flipped)}>↻ Flip Card</button></div>;}
