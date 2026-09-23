"use client";

import { useEffect, useState } from "react";
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
  const [events, setEvents] = useState<Event[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const data = await getJSON<Event[]>("/api/events", "events");
    if (data) setEvents(data);
  };
  useEffect(() => {
    load();
  }, []);

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
      <PageHeader title="Events" subtitle="What's happening at Innovin — tap Join to RSVP" />

      {!events ? (
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
      ) : events.length === 0 ? (
        <Card className="p-6">
          <Empty>Nothing scheduled right now — new events show up here.</Empty>
        </Card>
      ) : (
        <ul className="space-y-3">
          {events.map((e, i) => {
            const meta = CATEGORY_META[e.category] ?? CATEGORY_META.company;
            return (
              <li key={e.id} style={stagger(i)}>
                <Card className="gap-0 p-5">
                  <div className="flex items-start gap-3">
                    <IconTile icon={CalendarDays} tone={meta.tone} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-medium">{e.title}</h2>
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
                      disabled={busy === e.id}
                      onClick={() => rsvp(e)}
                      className="gap-1.5"
                    >
                      {e.mine && <Check className="size-3.5" />}
                      {e.mine ? "Going" : "Join"}
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
