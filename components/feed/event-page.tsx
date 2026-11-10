"use client";
import Link from "next/link";
import { Check, ChevronLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Flat } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Lappy } from "@/components/duo/lappy";
import { useEvent, useSend } from "@/lib/queries";

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...o }).format(new Date(iso));

// An event's detail page. Back returns to the Feed.
export function EventPage({ id }: { id: string }) {
  const query = useEvent(id);
  const rsvp = useSend<{ eventId: string; going: boolean }>(["event", id], "/api/events", "PATCH", { also: [["feed"]] });
  const event = query.data?.[0];
  const past = event ? Date.parse(event.startsAt) < Date.now() : false;
  const answer = (going: boolean) => rsvp.mutate({ eventId: id, going }, { onSuccess: () => toast.success(going ? "You're in!" : "Maybe next time"), onError: (e) => toast.error(e.message) });

  return (
    <div className="duo-col duo-screen-in">
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Link href="/feed?filter=event" aria-label="Back to feed" className="duo-btn duo-btn-g duo-btn-icon" style={{ width: 46 }}><ChevronLeft size={20} aria-hidden="true" /></Link>
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="duo-tag">{event ? `${event.category} · ${fmt(event.startsAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "Event"}</span>
          <h1 className="duo-h1">{event?.title ?? (query.isPending ? "Loading…" : "Event not found")}</h1>
        </div>
        <BellLink />
      </header>
      {query.isError && <Card role="alert"><span className="duo-sub">{query.error.message}</span></Card>}
      {!query.isPending && !event && !query.isError && (
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <Lappy pose="idle" width={110} decorative />
          <span className="duo-sub">This event was removed or never existed.</span>
          <Link href="/feed" className="duo-btn duo-btn-p">Back to the feed</Link>
        </Card>
      )}
      {event && (
        <>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {event.cancelledAt && <span className="duo-pill duo-tone-pink" style={{ alignSelf: "flex-start" }}>Cancelled</span>}
            <span style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{event.body || "No details yet."}</span>
            {event.location && <span className="duo-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={16} aria-hidden="true" />{event.location}</span>}
          </Card>
          {!event.cancelledAt && !past && (
            <section aria-label="Your answer" style={{ background: "var(--duo-sky)", borderRadius: 24, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 20, fontWeight: 700 }}>You coming?</span>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10 }}>
                <Button aria-pressed={event.mine} disabled={rsvp.isPending} onClick={() => answer(true)}><Check size={18} aria-hidden="true" />{event.mine ? "You're in" : "I'm in!"}</Button>
                <Button variant="ghost" aria-pressed={!event.mine} disabled={rsvp.isPending || !event.mine} onClick={() => answer(false)}>Not this time</Button>
              </div>
            </section>
          )}
          <Flat style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 36, fontWeight: 700, color: "var(--duo-brand)" }}>{event.going}</span>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>going</span>
          </Flat>
        </>
      )}
    </div>
  );
}
