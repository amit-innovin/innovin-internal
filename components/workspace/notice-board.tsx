"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getJSON, readError, send } from "@/lib/fetcher";
import { relativeTime } from "@/lib/format";
import type { PublicNotice } from "@/lib/notices";
import type { AnnouncementRow, NoticeRow } from "@/lib/types";
import { StudioDialog } from "./dialog";

export function NoticeBoard({ initial, announcements, canModerate = false, compact = false }: { initial: PublicNotice[]; announcements: AnnouncementRow[]; canModerate?: boolean; compact?: boolean }) {
  const [notes, setNotes] = useState(initial);
  const [draft, setDraft] = useState("");
  const [quickAnonymous, setQuickAnonymous] = useState(false);
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setNotes(initial), [initial]);
  async function reload() {
    const rows = await getJSON<PublicNotice[]>("/api/notices", "the notice board", { fresh: true });
    setFailed(!rows);
    if (rows) setNotes(rows);
  }
  async function react(id: string, emoji: string) {
    if (busy) return;
    setBusy(id);
    const res = await send("/api/notices", { method: "PATCH", json: { id, emoji } });
    if (!res.ok) toast.error(await readError(res)); else await reload();
    setBusy(null);
  }
  const visible = notes.filter(n => filter === "all" || n.kind === filter);
  return <section className="widget-card notice-board-widget" aria-label="Office Notice Board">
    <div className="widget-header">
      <div className="widget-title-group"><span className="widget-icon-pill coral"><FileText size={16} /></span><div><h2 className="widget-title">Office Notice Board</h2><span className="widget-sub">Quotes, Inspiration &amp; Team Feedback</span></div></div>
      <div className="notice-header-actions"><div className="notice-filter-tabs" aria-label="Filter board notes">
        {[["all", "All"], ["quote", "✨ Quotes"], ["feedback", "🔒 Feedback"]].map(([key, label]) => <button key={key} type="button" className={`notice-tab-btn ${filter === key ? "active" : ""}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span className="notice-badge-count">{notes.filter(n => key === "all" || n.kind === key).length}</span></button>)}
      </div><button className="primary-btn btn-sm btn-post-notice" onClick={() => setAdding(true)}><Plus size={13} /><span>Post Note</span></button></div>
    </div>
    {compact && <form className="phone-post-note-box" onSubmit={async e => { e.preventDefault(); if (!draft.trim()) { setAdding(true); return; } if (busy) return; setBusy("quick"); const res = await send("/api/notices", { method: "POST", json: { kind: "quote", body: draft, title: "", attribution: "", color: "yellow", anonymous: quickAnonymous } }); if (!res.ok) toast.error(await readError(res)); else { setDraft(""); await reload(); toast.success("Your note is pinned"); } setBusy(null); }}><input aria-label="Quick board note" placeholder="Post a thought, quote, or note..." value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} /><div className="phone-post-note-actions"><label className="phone-anon-toggle"><input type="checkbox" checked={quickAnonymous} onChange={e => setQuickAnonymous(e.target.checked)} />Post anonymously</label><button className="phone-btn-post-note" disabled={!!busy}>Post Note</button></div></form>}
    <div className="notice-board-canvas"><div className="notice-board-banner"><div className="banner-privacy-shield"><ShieldCheck size={13} /><span>Board posts are visible to teammates. <Link href="/grievances">Send private feedback ↗</Link></span></div></div>
      <div className="notice-cards-grid">
        {filter === "all" && announcements.map(a => <article key={`announcement-${a.id}`} className="notice-card memo-blue"><span className="card-pushpin" /><div className="card-header-bar"><span className="note-category-tag">📣 {a.tag}</span></div><h3 className="feedback-headline">{a.title}</h3><p className="feedback-body-desc">{a.body}</p><span className="card-time-ago">{relativeTime(a.createdAt)}</span></article>)}
        {visible.map(note => <article key={note.id} className={`notice-card memo-${note.color}`} aria-label={`Board note: ${note.title || note.body.slice(0, 40)}`}>
          <span className="card-pushpin" aria-hidden="true" />
          <div><div className="card-header-bar"><span className="note-category-tag">{note.kind === "quote" ? "✨ Quote" : "🔒 Team Feedback"}</span><span className={`note-anon-badge ${note.anonymous ? "" : "public-author"}`}>{note.anonymous ? "🔒 Anonymous" : "Public"}</span></div>
            <div className="note-author-row"><span className="author-anon-avatar">{note.anonymous ? "🕶️" : note.authorName?.[0]}</span><div className="author-meta-text"><span className="author-display-name">{note.anonymous ? "Anonymous Teammate" : note.authorName}</span><span className="author-role-time">{relativeTime(note.createdAt)}</span></div></div>
            {note.title && <h3 className="feedback-headline">{note.title}</h3>}<p className={note.kind === "quote" ? "quote-text-styled" : "feedback-body-desc"}>{note.body}</p>{note.attribution && <p className="quote-attribution-text">{note.attribution}</p>}
          </div><div className="card-footer-bar"><div className="card-rx-cluster">{note.reactions.map(rx => <button key={rx.emoji} className={`btn-card-rx ${rx.mine ? "selected" : ""}`} aria-label={`React ${rx.emoji}`} aria-pressed={rx.mine} disabled={busy === note.id} onClick={() => react(note.id, rx.emoji)}>{rx.emoji} <span className="rx-num">{rx.count}</span></button>)}</div>{canModerate && <button className="btn-icon-tiny" aria-label="Remove board note" disabled={!!busy} onClick={async () => { setBusy(note.id); const res = await send("/api/notices", { method: "DELETE", json: { id: note.id } }); if (!res.ok) toast.error(await readError(res)); else await reload(); setBusy(null); }}><Trash2 size={13} /></button>}</div>
        </article>)}
        {!visible.length && !(filter === "all" && announcements.length) && <div className="board-empty"><span>📌</span><h3>No notes found in this view</h3><p>Pin a quote, an idea, or feedback for the team.</p><button className="primary-btn btn-sm" onClick={() => setAdding(true)}>Post the first note</button></div>}
      </div>
      {failed && <button className="board-retry" onClick={reload}>Couldn&apos;t refresh the board. Try again.</button>}
    </div>
    {adding && <NoticeComposer onClose={() => setAdding(false)} onSaved={reload} />}
  </section>;
}

function NoticeComposer({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<NoticeRow["kind"]>("quote");
  const [anonymous, setAnonymous] = useState(false);
  const [color, setColor] = useState<NoticeRow["color"]>("yellow");
  const [busy, setBusy] = useState(false);
  return <StudioDialog title="Pin a note to the board" description="Everyone signed in can read this post. For confidential concerns, use Speak Up." onClose={onClose} className="modal-notice-card">
    <form className="studio-form" onSubmit={async e => { e.preventDefault(); if (busy) return; const fields = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); const res = await send("/api/notices", { method: "POST", json: { ...fields, kind, color, anonymous } }); if (!res.ok) { toast.error(await readError(res)); setBusy(false); return; } await onSaved(); onClose(); toast.success("Your note is pinned"); }}>
      <div className="notice-type-selector">{(["quote", "feedback"] as const).map(k => <button key={k} type="button" className={`notice-type-btn ${kind === k ? "active" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "quote" ? "✨ Quote / Inspiration" : "🔒 Team Feedback"}</button>)}</div>
      {kind === "feedback" && <label>Headline<input name="title" maxLength={120} required /></label>}
      <label>Your board note<textarea name="body" maxLength={2000} rows={5} required placeholder={kind === "quote" ? "A little inspiration for the team…" : "What could we improve together?"} /></label>
      {kind === "quote" && <label>Attribution (optional)<input name="attribution" maxLength={120} /></label>}
      <fieldset className="memo-color-picker-group"><legend>Memo color</legend><div className="memo-color-options">{(["yellow", "peach", "blue", "green", "purple"] as const).map(c => <button type="button" key={c} aria-label={`${c} memo`} aria-pressed={color === c} className={`memo-color-option memo-${c} ${color === c ? "selected" : ""}`} onClick={() => setColor(c)} />)}</div></fieldset>
      <label className="board-anonymous-option"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />Post anonymously</label>
      <p className="text-xs text-muted-foreground">{anonymous ? "Your name and account ID will not be stored with this post. The content remains visible to teammates." : "Your verified Google name will appear on your post."}</p>
      <button className="primary-btn" disabled={busy}>{busy ? "Pinning…" : "Pin to board"}</button>
      <Link className="text-xs text-muted-foreground" href="/grievances">Need to send private feedback? Open Speak Up ↗</Link>
    </form>
  </StudioDialog>;
}
