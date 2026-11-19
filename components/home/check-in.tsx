"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

