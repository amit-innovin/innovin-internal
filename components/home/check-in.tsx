"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button, Card } from "@/components/m3";
import type { DaysView } from "@/lib/days";
import { locationFailure } from "@/lib/locate";
import { MarkDayError, useMarkDay } from "@/lib/queries";

type Step = "idle" | "checking" | "success" | "outside" | "blocked" | "no-fix" | "closed";
const PROBLEMS: Step[] = ["outside", "blocked", "no-fix", "closed"];
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
export const timeIST = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)).replace(/\s?(am|pm)$/i, "");

const position = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
  navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
});

// "Check in" from the prototype's Home. The location is read once, on the tap, and checked by the
// server against the office geofence. Once the day is marked, the card plays its confirmation and
// disappears; the header chip takes over (no check-out). There is no remote mark: not coming in
// means remote. On a day you aren't planned in, the card shrinks to a quiet row.
// The check-in flow, shared by the Check in card and Today's title button and phone FAB.
export function useCheckIn() {
  const mark = useMarkDay();
  const [step, setStep] = useState<Step>("idle");
  const [distance, setDistance] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const settle = (next: Step, ms: number) => { setStep(next); timer.current = setTimeout(() => setStep("idle"), ms); };
  const fail = (error: unknown) => {
    if (error instanceof MarkDayError && error.code === "outside") { setDistance(error.distanceM ?? null); return setStep("outside"); }
    if (error instanceof MarkDayError && error.code === "location-needed") return setStep("blocked");
    if (error instanceof MarkDayError && error.code === "closed") return setStep("closed");
    setStep("idle");
    toast.error(error instanceof Error ? error.message : "That didn't work. Please try again.");
  };
  const checkIn = async () => {
    setStep("checking");
    let coords: GeolocationCoordinates;
    try { coords = (await position()).coords; } catch (error) { return setStep(locationFailure(error)); }
    mark.mutate({ mode: "office", lat: coords.latitude, lng: coords.longitude, accuracyM: coords.accuracy }, { onSuccess: () => settle("success", 1100), onError: fail });
  };
  const problem = !PROBLEMS.includes(step) ? null : {
    title: step === "outside" ? `You're about ${distance !== null ? km(distance) : "a long way"} from the office` : step === "no-fix" ? "Couldn't get your location" : step === "closed" ? "The office is closed today" : "Location is off for innovin",
    body: step === "outside" ? "Check-in works close to the office. If you're at the door, step outside for a better signal and try again." : step === "no-fix" ? "The signal is weak indoors. Move near a window and try again." : step === "closed" ? "Check-in is off for today." : "Allow location for this site in your browser settings, then try again. It's only read when you tap Check in.",
  };
  return { step, distance, problem, busy: step === "checking" || mark.isPending, checkIn, dismiss: () => setStep("idle") };
}

export function CheckIn({ days }: { days: DaysView }) {
  const { step, distance, busy, checkIn } = useCheckIn();
  if (days.me && step === "idle") return null;
  if (!days.isOfficeDayToday && step === "idle") {
    return (
      <Card aria-label="Check in" role="region" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600 }}>Not planned in today</span>
          <span className="m3-small">In the office after all?</span>
        </span>
        <Button variant="tonal" disabled={busy} onClick={checkIn}>Check in</Button>
      </Card>
    );
  }
  const tone = step === "success" ? "var(--m3-success-container)" : "var(--m3-surface)";

  return (
    <Card aria-label="Check in" role="region" className="m3-stack" style={{ background: tone, transition: "background-color .3s ease" }}>
      {step === "success" ? (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span aria-hidden="true" className="m3-done-mark">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" className="m3-draw" /></svg>
          </span>
          <span>
            <span style={{ display: "block", fontSize: 20, lineHeight: "26px", fontWeight: 600, color: "var(--m3-on-success-container)" }}>You're in</span>
            <span className="m3-small" style={{ color: "var(--m3-on-success-container)" }}>Checked in{days.me ? ` at ${timeIST(days.me.at)}` : ""} · location confirmed</span>
          </span>
        </div>
      ) : (
        <>
          <h2 className="m3-title" style={{ fontSize: 20, lineHeight: "26px" }}>{days.isOfficeDayToday ? "One of your office days" : "Not checked in yet"}</h2>
          {step === "checking" ? (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}><LoaderCircle size={22} className="m3-spin" aria-hidden="true" />Checking your location…</div>
          ) : PROBLEMS.includes(step) ? (
            <div role="alert" style={{ background: "var(--m3-warn-container)", color: "var(--m3-on-warn-container)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
              <b>{step === "outside" ? `You're about ${distance !== null ? km(distance) : "a long way"} from the office` : step === "no-fix" ? "Couldn't get your location" : step === "closed" ? "The office is closed today" : "Location is off for innovin"}</b>
              <span className="m3-body">{step === "outside" ? "Check-in works close to the office. If you're at the door, step outside for a better signal and try again." : step === "no-fix" ? "The signal is weak indoors. Move near a window and try again." : step === "closed" ? "Check-in is off for today." : "Allow location for this site in your browser settings, then try again. It's only read when you tap Check in."}</span>
            </div>
          ) : (
            <span className="m3-small" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><MapPin size={18} aria-hidden="true" style={{ flex: "none", marginTop: 1 }} />We check your location once, when you tap Check in. It isn't tracked.</span>
          )}
          {step !== "closed" && <Button className="m3-btn-lg" disabled={busy} onClick={checkIn}>{PROBLEMS.includes(step) ? "Try again" : "Check in"}</Button>}
        </>
      )}
    </Card>
  );
}
