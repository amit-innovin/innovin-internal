"use client";
import { WorkspaceLink as Link } from "@/components/m3/workspace-link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { QueryState } from "@/components/m3";
import { useEvent, useSend } from "@/lib/queries";

const at = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...o }).format(new Date(iso));
const CATEGORY: Record<string, [string, string, string]> = {
  social: ["Celebration", "#FFD9E2", "#3F0017"], culture: ["Culture", "#FFF1C2", "#3D2E00"], learning: ["Learning", "#D3E5F5", "#0C1D29"],
  sports: ["Sports", "#CDEBD6", "#0B3D1F"], arts: ["Arts", "#EBDCFF", "#20142F"], company: ["Company", "#E5E8EE", "#41474D"],
};

// Event details (canvas: M3EventDetails). A detail screen: back to the Feed, when and where, and an
// answer for upcoming events. No headcount for members, as in the Feed.
export function EventPage({ id }: { id: string }) {
  const query = useEvent(id);
  const rsvp = useSend<{ eventId: string; going: boolean }>(["event", id], "/api/events", "PATCH", { also: [["feed"]] });
  const event = query.data?.[0];
  const past = event ? Date.parse(event.startsAt) < Date.now() : false;
  const answered = rsvp.isSuccess ? rsvp.variables?.going : undefined;
  const going = answered ?? event?.mine ?? false;
  const notGoing = answered === false;
  const answer = (yes: boolean) => rsvp.mutate({ eventId: id, going: yes }, { onError: (e) => toast.error(e.message) });
  const [cat, catBg, catFg] = CATEGORY[event?.category ?? ""] ?? CATEGORY.company;

  return (
    <div className="m3 m3-page pg-wide m3-stack">
      <header style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Link href="/feed" className="m3-btn m3-btn-text" aria-label="Back to feed" style={{ height: 40, padding: "0 12px 0 6px", color: "var(--m3-on-surface)" }}><ArrowLeft size={20} aria-hidden="true" />Feed</Link>
      </header>

      {!query.data ? <QueryState error={query.error} onRetry={() => query.refetch()} what="this event" /> : !event ? (
        <section className="m3-card m3-stack" style={{ gap: 12, alignItems: "flex-start", marginTop: 24 }}>
          <h1 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>This event isn&apos;t here any more</h1>
          <p className="m3-body" style={{ margin: 0, color: "var(--m3-on-surface-variant)" }}>It may have been removed, or the link is wrong.</p>
          <Link href="/feed" className="m3-btn m3-btn-filled">Back to Feed</Link>
        </section>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span aria-hidden="true" className="ev-date"><span>{at(event.startsAt, { month: "short" })}</span><b>{at(event.startsAt, { day: "numeric" })}</b></span>
            <div className="pg-head-text">
              <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 700, lineHeight: "16px", padding: "4px 10px", borderRadius: 8, background: catBg, color: catFg }}>{cat}</span>
              <h1 className="pg-h1">{event.title}</h1>
            </div>
          </div>

          {event.cancelledAt && <div role="status" style={{ background: "var(--m3-error-container, #FFDAD6)", color: "#410002", borderRadius: 16, padding: "12px 16px", fontWeight: 600 }}>This event was cancelled</div>}

          <div className="pg-cols">
          <section aria-label="When and where" className="pg-card" style={{ gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <Circle><CalendarDays size={20} /></Circle>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600 }}>{at(event.startsAt, { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className="m3-small" style={{ fontSize: 14 }}>{at(event.startsAt, { hour: "numeric", minute: "2-digit" })}</span>
              </span>
            </div>
            {event.location && <div style={{ display: "flex", alignItems: "center", gap: 14 }}><Circle><MapPin size={20} /></Circle><span style={{ fontWeight: 600 }}>{event.location}</span></div>}
            {event.body && <p className="m3-body" style={{ margin: 0, whiteSpace: "pre-line" }}>{event.body}</p>}
          </section>

          <aside className="pg-rail">
          {!event.cancelledAt && !past && (
            <section aria-labelledby="ans-h" className="pg-card" style={{ gap: 14 }}>
              <h2 id="ans-h" className="m3-title">Are you going?</h2>
              <div role="group" aria-labelledby="ans-h" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <button type="button" aria-pressed={going} disabled={rsvp.isPending} onClick={() => answer(true)}
                  className={`m3-btn ${going ? "m3-btn-filled" : "m3-btn-outlined"}`} style={{ height: 48 }}>
                  {going && <Check size={18} aria-hidden="true" />}{going ? "You're going" : "I'm going"}
                </button>
                <button type="button" aria-pressed={notGoing} disabled={rsvp.isPending} onClick={() => answer(false)}
                  className={`m3-btn ${notGoing ? "m3-btn-filled" : "m3-btn-outlined"}`} style={{ height: 48 }}>Not this time</button>
              </div>
              {event.inCalendar && <span className="m3-small">It&apos;s in your Google Calendar too.</span>}
            </section>
          )}
          {past && !event.cancelledAt && <p className="m3-body" style={{ margin: "0 4px", color: "var(--m3-on-surface-variant)" }}>This event has passed.</p>}
          </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Circle({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, borderRadius: 20, background: "var(--m3-surface-container, #E5E8EE)", color: "var(--m3-on-surface-variant)", display: "grid", placeItems: "center" }}>{children}</span>;
}
