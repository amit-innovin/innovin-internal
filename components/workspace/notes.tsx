"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Paperclip, Send, Trash2, Users, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { readError, send } from "@/lib/fetcher";
import { useHoverCapable } from "@/lib/hooks/use-hover-capable";
import { PING_MAX_LEN } from "@/lib/pings";
import type { WorkspaceData } from "@/lib/workspace";
import { StudioDialog } from "./dialog";

type Props = {
  people: WorkspaceData["people"];
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floatingTrigger: boolean;
  onSaved: () => Promise<void>;
};

export function PaperNotes({ people, email, open, onOpenChange, floatingTrigger, onSaved }: Props) {
  const recipientId = useId();
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const [tag, setTag] = useState("🙌 Shoutout");
  const [busy, setBusy] = useState(false);
  const [animation, setAnimation] = useState<"fly" | "crumple" | null>(null);
  const reduce = useReducedMotion();
  const hover = useHoverCapable();
  const targets = people.filter(p => p.email !== email);
  const team = to === "team";
  const max = PING_MAX_LEN - tag.length - 2;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !to || !text.trim()) return;
    setBusy(true);
    const res = team
      ? await send("/api/notices", { method: "POST", json: { kind: "quote", title: tag, body: text.trim(), attribution: "", color: "yellow", anonymous: false } })
      : await send("/api/pings", { method: "POST", json: { to, body: `${tag}: ${text.trim()}` } });
    if (!res.ok) { setBusy(false); toast.error(await readError(res)); return; }
    onOpenChange(false);
    setText("");
    setAnimation("fly");
    setBusy(false);
    toast.success(team ? "Your note is on the team board" : "Your note is on its way");
    if (team) await onSaved();
  }

  return <>
    {floatingTrigger && <button className="paper-trigger-btn reference-paper-trigger" onClick={() => onOpenChange(true)} aria-label="Write a paper note"><span className="origami-icon-wrapper"><Paperclip size={22} /></span><span className="paper-trigger-label">Drop a Paper Note</span></button>}
    {open && <StudioDialog className="reference-paper-dialog" title="Drop a paper note" description={team ? "Post a note for everyone on the Office Notice Board." : "Choose the whole team or send a private note to one teammate."} onClose={() => { if (!busy) onOpenChange(false); }}>
      <form className="paper-sheet-inner studio-form" onSubmit={submit} aria-busy={busy}>
        <label htmlFor={recipientId}>To</label><select id={recipientId} value={to} required disabled={busy} onChange={e => setTo(e.target.value)} aria-describedby="paper-note-visibility"><option value="">Choose who can read this</option><option value="team">Whole team - shared board</option>{targets.map(p => <option value={p.email} key={p.email}>{p.name}</option>)}</select>
        <p id="paper-note-visibility" className="paper-note-visibility" role="status">{team ? <><Users size={16} />Everyone can read this note on the shared board. It stays until an admin removes it.</> : to ? <><LockKeyhole size={16} />Private to this teammate. Disappears after 24 hours.</> : "Choose a recipient before sending. Team notes are visible to everyone."}</p>
        {!targets.length && <p className="studio-notice">You can post to the whole team now. Individual teammates appear after they sign in.</p>}
        <div className="paper-tags-row">{["🙌 Shoutout", "☕ Coffee run", "💡 Idea", "🎵 Music"].map(t => <button type="button" disabled={busy} className={`paper-tag ${tag === t ? "active" : ""}`} key={t} aria-pressed={tag === t} onClick={() => { setTag(t); setText(s => s.slice(0, PING_MAX_LEN - t.length - 2)); }}>{t}</button>)}</div>
        <label>Your note<textarea className="paper-writing reference-paper-writing" value={text} disabled={busy} required maxLength={max} onChange={e => setText(e.target.value)} rows={5} placeholder={team ? "Something for everyone…" : "Hey, just wanted to say…"} /></label><small className="text-right text-muted-foreground">{text.length}/{max}</small>
        <div className="flex gap-3"><button className="paper-action-btn btn-send-plane flex-1" disabled={busy || !to || !text.trim()}><Send size={16} />{busy ? "Sending…" : team ? "Post to whole team" : "Send airplane"}</button><button type="button" className="studio-icon-button" aria-label="Crumple and discard note" disabled={busy} onClick={() => { setText(""); onOpenChange(false); setAnimation("crumple"); }}><Trash2 size={19} /></button></div>
      </form>
    </StudioDialog>}
    <AnimatePresence>{animation && <motion.div key={animation} className="paper-animation" aria-hidden="true" initial={{ x: 0, y: 0, rotate: 0, scale: 1 }} animate={reduce ? { opacity: 0 } : !hover ? { y: -24, opacity: 0 } : animation === "fly" ? { x: [0, -100, -500], y: [0, -100, -650], rotate: [0, -20, -45], scale: [1, 1.2, .4], opacity: [1, 1, 0] } : { y: [0, -30, 160], rotate: [0, 60, 200], scale: [1, .5, .2], opacity: [1, 1, 0] }} transition={{ duration: reduce ? .1 : hover ? .8 : .18 }} onAnimationComplete={() => setAnimation(null)}>{animation === "fly" ? "✈️" : "🗑️"}</motion.div>}</AnimatePresence>
  </>;
}
