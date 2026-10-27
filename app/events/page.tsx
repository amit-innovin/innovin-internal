"use client";
import { EventManageButton } from "@/components/event-editor";
import { useSearchParams } from "next/navigation";
import { LoadRecovery } from "@/components/load-recovery";

import { useEffect, useState,useRef } from "react";
import { CalendarDays, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Empty, IconTile, PageHeader, stagger, type Tone } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { fmtDay, fmtTime } from "@/lib/format";
import type { EventCategory } from "@/lib/types";

type Event = {
  id: string;
  title: string;
  body: string;
  category: EventCategory;
  startsAt: string;
  location: string;
  going: number;
  mine: boolean;
  canManage?: boolean; updatedAt?: string; cancelledAt?:string; createdAt:string;
};

const CATEGORY_META: Record<EventCategory, { label: string; tone: Tone }> = {
  sports: { label: "Sports", tone: "green" },
  arts: { label: "Arts", tone: "rose" },
  culture: { label: "Culture", tone: "amber" },
  learning: { label: "Learning", tone: "blue" },
  social: { label: "Social", tone: "sky" },
  company: { label: "Company", tone: "ink" },
};

const istDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
// "Today" / "Tomorrow" / "Fri, 26 Sep" — relativeDay() is past-oriented, events are future-facing.
const dayLabel = (iso: string) => {
  const diff = Math.round((Date.parse(istDay(new Date(iso))) - Date.parse(istDay(new Date()))) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return fmtDay(new Date(iso));
};

export default function Events() {
  const params=useSearchParams();
  const focused=params.get("event");
  const loadVersion=useRef(0);
  const [resolvedTarget,setResolvedTarget]=useState<string|null|undefined>(undefined);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (id?:string) => {
    const version=++loadVersion.current;setResolvedTarget(undefined);
    const data = await getJSON<Event[]>("/api/events", "events",{fresh:true});
    if(!data)return;const target=id??focused;const extra=target&&!data.some(e=>e.id===target)?await getJSON<Event[]>(`/api/events?event=${encodeURIComponent(target)}`,"the event",{fresh:true}):[];
    if(version===loadVersion.current){setEvents([...(extra??[]),...data]);if(extra!==null)setResolvedTarget(target??null);}
  };
  useEffect(() => { void load(); return()=>{loadVersion.current++;}; }, [focused]);
  useEffect(()=>{if(focused&&events)document.getElementById(`event-${focused}`)?.scrollIntoView({block:"center",behavior:"smooth"});},[focused,events]);

  async function rsvp(e: Event) {
    setBusy(e.id);
    const res = await send("/api/events", { method: "PATCH", json: { eventId: e.id, going: !e.mine } });
    if (res.ok) {
      const { going, count } = await res.json();
      setEvents((list) => (list ?? []).map((x) => (x.id === e.id ? { ...x, mine: going, going: count } : x)));
      if (going) toast.success("You're in!");
    } else {
      toast.error(await readError(res));
    }
    setBusy(null);
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Events" subtitle="What's coming up — tap Join and you're in." />

      {focused && resolvedTarget===focused && events && !events.some(e=>e.id===focused) && <p role="status" className="studio-notice">This event is no longer available.</p>}
      {!events ? (<LoadRecovery>
        <div className="space-y-3">
          <Card className="gap-3 p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </Card>
          <Card className="gap-3 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </Card>
        </div>
      </LoadRecovery>) : events.length === 0 ? (
        <Card className="p-6">
          <Empty>Nothing on the calendar yet — good things land here first.</Empty>
        </Card>
      ) : (
        <ul className="space-y-3">
          {events.map((e, i) => {
            const meta = CATEGORY_META[e.category] ?? CATEGORY_META.company;
            return (
              <li key={e.id} id={`event-${e.id}`} style={stagger(i)}>
                <Card className="gap-0 p-5">
                  <div className="flex items-start gap-3">
                    <IconTile icon={CalendarDays} tone={meta.tone} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-medium">{e.canManage ? <EventManageButton event={e} onSaved={load} /> : <>{e.title}{e.cancelledAt?" · Cancelled":""}</>}</h2>
                        <Badge variant="secondary" className="shrink-0">
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {dayLabel(e.startsAt)} · {fmtTime(e.startsAt)}
                        {e.location && (
                          <span className="inline-flex items-center gap-0.5">
                            {" "}
                            · <MapPin className="inline size-3" /> {e.location}
                          </span>
                        )}
                      </p>
                      {e.body && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{e.body}</p>}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3.5">
                    <p className="text-xs text-muted-foreground">
                      {e.going === 0 ? "Be the first to join" : `${e.going} going`}
                    </p>
                    <Button
                      size="sm"
                      variant={e.mine ? "secondary" : "default"}
                      disabled={busy === e.id || !!e.cancelledAt}
                      onClick={() => rsvp(e)}
                      className="gap-1.5"
                    >
                      {e.mine && <Check className="size-3.5" />}
                      {e.cancelledAt?"Cancelled":e.mine ? "Cancel RSVP" : "Join"}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
