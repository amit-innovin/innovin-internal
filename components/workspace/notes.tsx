"use client";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Paperclip, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { readError, send } from "@/lib/fetcher";
import { PING_MAX_LEN } from "@/lib/pings";
import type { WorkspaceData } from "@/lib/workspace";
import { StudioDialog } from "./dialog";

export function PaperNotes({ people, email }: { people: WorkspaceData["people"]; email: string }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [to, setTo] = useState("");
  const [tag, setTag] = useState("🙌 Shoutout"), [busy, setBusy] = useState(false);
  const [animation, setAnimation] = useState<"fly" | "crumple" | null>(null);
  const reduce = useReducedMotion();
  const targets = people.filter((p) => p.email !== email);
  const max = PING_MAX_LEN - tag.length - 2;
  return <><button className="paper-trigger-btn reference-paper-trigger" onClick={() => setOpen(true)} aria-label="Write a paper note"><span className="origami-icon-wrapper"><Paperclip size={22}/></span><span className="paper-trigger-label">Drop a Paper Note</span><span className="paper-badge-ping"/></button>
    {open && <StudioDialog className="reference-paper-dialog" title="INNOVIN DESK THOUGHTS" description="Send a private note to a teammate. Like other pings, it disappears after 24 hours." onClose={() => { if (!busy) setOpen(false); }}><form className="paper-sheet-inner studio-form" onSubmit={async (e) => { e.preventDefault(); if (busy) return; setBusy(true); const res = await send("/api/pings", { method: "POST", json: { to, body: `${tag}: ${text.trim()}` } }); if (!res.ok) { setBusy(false); return toast.error(await readError(res)); } setOpen(false); setText(""); setAnimation("fly"); setBusy(false); toast.success("Your note is on its way"); }}>
      <label>To<select value={to} required onChange={(e) => setTo(e.target.value)}><option value="">Pick a teammate</option>{targets.map((p) => <option value={p.email} key={p.email}>{p.name}</option>)}</select></label>
      {!targets.length && <p className="studio-notice">Your teammates will appear after they sign in.</p>}
      <div className="paper-tags-row">{["🙌 Shoutout", "☕ Coffee run", "💡 Idea", "🎵 Music"].map((t) => <button type="button" className={`paper-tag ${tag===t?"active":""}`} key={t} aria-pressed={tag === t} onClick={() => { setTag(t); setText((s) => s.slice(0, PING_MAX_LEN - t.length - 2)); }}>{t}</button>)}</div>
      <label>Your note<textarea className="paper-writing reference-paper-writing" value={text} required maxLength={max} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Hey, just wanted to say…" /></label><small className="text-right text-muted-foreground">{text.length}/{max}</small>
      <div className="flex gap-3"><button className="paper-action-btn btn-send-plane flex-1" disabled={busy || !to || !text.trim()}><Send size={16} />{busy ? "Sending…" : "Send airplane"}</button><button type="button" className="studio-icon-button" aria-label="Crumple and discard note" disabled={busy} onClick={() => { setText(""); setOpen(false); setAnimation("crumple"); }}><Trash2 size={19} /></button></div>
    </form></StudioDialog>}
    <AnimatePresence>{animation && <motion.div key={animation} className="paper-animation" aria-hidden="true" initial={{ x: 0, y: 0, rotate: 0, scale: 1 }} animate={reduce ? { opacity: 0 } : animation === "fly" ? { x: [0, -100, -500], y: [0, -100, -650], rotate: [0, -20, -45], scale: [1, 1.2, .4], opacity: [1, 1, 0] } : { y: [0, -30, 160], rotate: [0, 60, 200], scale: [1, .5, .2], opacity: [1, 1, 0] }} transition={{ duration: reduce ? .1 : 1.1 }} onAnimationComplete={() => setAnimation(null)}>{animation === "fly" ? "✈️" : "🗑️"}</motion.div>}</AnimatePresence>
  </>;
}
