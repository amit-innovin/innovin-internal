"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { send,readError } from "@/lib/fetcher";
import { StudioDialog } from "@/components/workspace/dialog";
import type { EventRow } from "@/lib/types";
export type EditableEvent=Omit<EventRow,"createdBy">;
export function EventEditor({event,onClose,onSaved}:{event?:EditableEvent;onClose:()=>void;onSaved:(id?:string)=>Promise<void>}) {
  const [busy,setBusy]=useState(false);
  const localTime=event?new Date(Date.parse(event.startsAt)+330*60000).toISOString().slice(0,16):"";
  async function cancel() {
    if(!event || busy || !window.confirm("Cancel this event? Attendees will see that it is cancelled."))return;
    setBusy(true);const res=await send("/api/events",{method:"DELETE",json:{id:event.id,expectedUpdatedAt:event.updatedAt??event.createdAt}});
    if(!res.ok){setBusy(false);toast.error(await readError(res));return;}await onSaved(event.id);onClose();toast.success("Event cancelled");
  }
  return <StudioDialog title={event?"Update your event":"Bring people together"} description="Publish details for the team. Times are in India Standard Time." onClose={()=>{if(!busy)onClose();}}><form className="studio-form" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);const fields=Object.fromEntries(new FormData(e.currentTarget));const res=await send("/api/events",{method:event?"PATCH":"POST",json:event?{...fields,action:"update",id:event.id,expectedUpdatedAt:event.updatedAt??event.createdAt}:fields});if(!res.ok){setBusy(false);toast.error(await readError(res));return;}const result=await res.json();await onSaved(result.event?.id);onClose();toast.success(event?"Event updated":"Event published");}}>
    <label>Event title<input name="title" defaultValue={event?.title} required maxLength={120} /></label>
    <label>Date &amp; time (IST)<input type="datetime-local" name="startsAt" defaultValue={localTime} required /></label>
    <label>Location<input name="location" defaultValue={event?.location} maxLength={80} /></label>
    <label>Category<select name="category" defaultValue={event?.category??"social"}>{["sports","arts","culture","learning","social","company"].map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></label>
    <label>A little more detail<textarea name="body" defaultValue={event?.body} maxLength={500} rows={3} /></label>
    <button className="studio-button" disabled={busy}>{busy?"Saving…":event?"Save changes":"Publish event"}</button>
    {event && <button className="studio-text-button" type="button" disabled={busy} onClick={cancel}>Cancel event</button>}
  </form></StudioDialog>;
}
export function EventManageButton({event,onSaved,canEdit=true}:{event:EditableEvent;onSaved?:(id?:string)=>Promise<void>;canEdit?:boolean}) {
  const [open,setOpen]=useState(false);const router=useRouter();
  if(!canEdit)return <>{event.title}</>;
  if(event.cancelledAt)return <>{event.title} · Cancelled</>;
  return <><button className="text-left font-[inherit]" aria-label={`Edit ${event.title}`} onClick={()=>setOpen(true)}>{event.title}</button>{open&&<EventEditor event={event} onClose={()=>setOpen(false)} onSaved={async(id)=>{if(onSaved)await onSaved(id);else router.refresh();}} />}</>;
}
