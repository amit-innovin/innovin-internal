"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { getJSON, readError, send } from "@/lib/fetcher";
import { fmtShortDate, fmtTime } from "@/lib/format";
import type { WorkspaceData } from "@/lib/workspace";
import { StudioDialog } from "./dialog";

type Event = WorkspaceData["events"][number] & { mine?: boolean };
export function WorkspaceEvents({ initial, onSaved }: { initial: WorkspaceData["events"]; onSaved: () => Promise<void> }) {
  const [events, setEvents] = useState<Event[]>(initial);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => { const e = await getJSON<Event[]>("/api/events", "events", { fresh: true }); if (e) setEvents(e); };
  useEffect(() => { load(); }, [initial]);
  return <section className="widget-card events-widget events-card"><div className="widget-header"><div className="widget-title-group"><span className="widget-icon-pill"><CalendarDays size={16} /></span><div><h2 className="widget-title">Today's Office Events</h2><span className="widget-sub">Workshops, townhalls &amp; team activities</span></div></div><button className="btn-primary-action-sm" onClick={() => setAdding(true)}><Plus size={14} />Add event</button></div>
    <div className="events-list events-timeline">{events.length ? events.slice(0, 8).map((e) => <article key={e.id} className="event-item-card"><div className="event-time-col"><span className="event-time-val">{fmtTime(e.startsAt)}</span><span className="event-status-pill">{fmtShortDate(e.startsAt)}</span></div><div className="event-info-col"><span className="event-category-tag">{e.category}</span><h3 className="event-title-text">{e.title}</h3><span className="event-location-text">📍 {e.location || "Location to be shared"}</span></div><div className="event-rsvp-col"><span className="rsvp-counter"><strong>{e.going}</strong> going</span><button className={`btn-rsvp ${e.mine ? "attending" : ""}`} disabled={busy === e.id} onClick={async () => { setBusy(e.id); const res = await send("/api/events", { method: "PATCH", json: { eventId: e.id, going: !e.mine } }); if (!res.ok) toast.error(await readError(res)); else await load(); setBusy(null); }}>{e.mine ? "Going" : "RSVP"}</button></div></article>) : <div className="studio-empty"><CalendarDays size={30} /><h3>Make room for a shared moment.</h3><p>A demo, a coffee catch-up, a team lunch. Start something.</p><button className="studio-text-button" onClick={() => setAdding(true)}>Create the first event ↗</button></div>}</div>
    {adding && <EventEditor onClose={() => setAdding(false)} onSaved={async () => { await onSaved(); await load(); }} />}
  </section>;
}

function EventEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <StudioDialog title="Bring people together" description="Publish an event for the team. Times are in India Standard Time." onClose={onClose}><form className="studio-form" onSubmit={async (e) => { e.preventDefault(); if (busy) return; const json = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); const res = await send("/api/events", { method: "POST", json }); if (!res.ok) { setBusy(false); return toast.error(await readError(res)); } await onSaved(); onClose(); toast.success("Event published"); }}>
    <label>Event title<input name="title" required maxLength={120} placeholder="What's the occasion?" /></label>
    <label>Date & time (IST)<input type="datetime-local" name="startsAt" required /></label>
    <label>Location<input name="location" maxLength={80} placeholder="Office, meeting room or video link" /></label>
    <label>Category<select name="category" defaultValue="social">{["sports", "arts", "culture", "learning", "social", "company"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></label>
    <label>A little more detail<textarea name="body" maxLength={500} rows={3} /></label>
    <button className="studio-button" disabled={busy}>{busy ? "Publishing…" : "Publish event"}</button>
  </form></StudioDialog>;
}
