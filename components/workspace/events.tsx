"use client";
import { EventEditor, EventManageButton } from "@/components/event-editor";
import { useEffect, useState,useRef } from "react";
import { CalendarDays, Clock, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { getJSON, readError, send } from "@/lib/fetcher";
import { fmtShortDate, fmtTime } from "@/lib/format";
import type { WorkspaceData } from "@/lib/workspace";
import { StudioDialog } from "./dialog";

type Event = WorkspaceData["events"][number] & { mine?: boolean; canManage?: boolean };
export function WorkspaceEvents({ initial, onSaved }: { initial: WorkspaceData["events"]; onSaved: () => Promise<void> }) {
  const focusId=useRef<string|undefined>(undefined);
  const [events, setEvents] = useState<Event[]>(initial);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = async (id?:string) => { if(id)focusId.current=id; const e=await getJSON<Event[]>("/api/events","events",{fresh:true});if(!e)return;const target=focusId.current;const extra=target&&!e.some(row=>row.id===target)?await getJSON<Event[]>(`/api/events?event=${encodeURIComponent(target)}`,"your event",{fresh:true}):[];const rows=[...(extra??[]),...e];setEvents(target?[...rows.filter(row=>row.id===target),...rows.filter(row=>row.id!==target)]:rows); };
  useEffect(() => { load(); }, [initial]);
  return <section className="widget-card events-widget events-card"><div className="widget-header"><div className="widget-title-group"><span className="widget-icon-pill"><CalendarDays size={16} /></span><div><h2 className="widget-title">Upcoming Office Events</h2><span className="widget-sub">Workshops, townhalls &amp; team activities</span></div></div><button className="btn-primary-action-sm" onClick={() => setAdding(true)}><Plus size={14} />Add event</button></div>
    <div className="events-list events-timeline">{events.length ? events.slice(0, 8).map((e) => <article key={e.id} className="event-item-card"><div className="event-time-col"><span className="event-time-val">{fmtTime(e.startsAt)}</span><span className="event-status-pill">{fmtShortDate(e.startsAt)}</span></div><div className="event-info-col"><span className="event-category-tag">{e.category}</span><h3 className="event-title-text">{e.canManage ? <EventManageButton event={e} onSaved={load} /> : <>{e.title}{e.cancelledAt ? " · Cancelled" : ""}</>}</h3><span className="event-location-text">📍 {e.location || "Location to be shared"}</span></div><div className="event-rsvp-col"><span className="rsvp-counter"><strong>{e.going}</strong> going</span><button className={`btn-rsvp ${e.mine ? "attending" : ""}`} disabled={busy === e.id || !!e.cancelledAt} onClick={async () => { setBusy(e.id); const res = await send("/api/events", { method: "PATCH", json: { eventId: e.id, going: !e.mine } }); if (!res.ok) toast.error(await readError(res)); else await load(); setBusy(null); }}>{e.cancelledAt ? "Cancelled" : e.mine ? "Cancel RSVP" : "RSVP"}</button></div></article>) : <div className="studio-empty"><CalendarDays size={30} /><h3>Make room for a shared moment.</h3><p>A demo, a coffee catch-up, a team lunch. Start something.</p><button className="studio-text-button" onClick={() => setAdding(true)}>Create the first event ↗</button></div>}</div>
    {adding && <EventEditor onClose={() => setAdding(false)} onSaved={async (id) => { await onSaved(); await load(id); }} />}
  </section>;
}
