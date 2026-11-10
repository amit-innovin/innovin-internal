"use client";
import { useState } from "react";
import { Building2, Check, LoaderCircle, Lock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button, Flat, Tile, type Tone } from "@/components/duo";
import { Sheet } from "@/components/duo/sheet";
import type { DaysView } from "@/lib/days";
import { MarkDayError, useMarkDay } from "@/lib/queries";

type Step = null | "ask" | "locating" | "outside" | "blocked";
const SOURCE: Record<string, string> = { wifi: "Verified on office Wi-Fi", location: "Verified by location", self: "Marked by you", late: "Added later", admin: "Set by an admin" };
const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

const position = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
  navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
});

function Explain({ icon, tone, title, children }: { icon: React.ReactNode; tone: Tone; title: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Tile tone={tone}>{icon}</Tile>
        <h2 className="duo-h2" style={{ fontSize: 21, lineHeight: 1.15 }}>{title}</h2>
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>{children}</p>
    </>
  );
}

// "I'm in the office" and "Working remote today". Office is checked by the server: office
// Wi-Fi first, and only if that can't prove it do we ask for a location, once. No check-out.
export function CheckIn({ days }: { days: DaysView }) {
  const mark = useMarkDay();
  const [step, setStep] = useState<Step>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const mode = days.me?.mode ?? null;

  const fail = (error: unknown) => {
    if (error instanceof MarkDayError && error.code === "location-needed") return setStep("ask");
    if (error instanceof MarkDayError && error.code === "outside") { setDistance(error.distanceM ?? null); return setStep("outside"); }
    setStep(null);
    toast.error(error instanceof Error ? error.message : "That didn't work. Please try again.");
  };
  const office = () => mark.mutate({ mode: "office" }, { onSuccess: () => setStep(null), onError: fail });
  const remote = () => mark.mutate({ mode: "remote" }, { onSuccess: () => setStep(null), onError: fail });
  const withLocation = async () => {
    setStep("locating");
    try {
      const { coords } = await position();
      mark.mutate({ mode: "office", lat: coords.latitude, lng: coords.longitude, accuracyM: coords.accuracy }, { onSuccess: () => setStep(null), onError: fail });
    } catch {
      setStep("blocked");
    }
  };
  const busy = mark.isPending || step === "locating";

  return (
    <>
      {mode === "office" ? (
        <div className="duo-in">
          <span className="duo-tile" style={{ background: "var(--duo-seg-on)", borderRadius: 20, width: 40, height: 40 }} aria-hidden="true"><Check size={22} strokeWidth={2.6} /></span>
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--duo-display)", fontSize: 20, fontWeight: 700 }}>You're in today</span>
            <span style={{ fontSize: 12, fontWeight: 800 }}>{SOURCE[days.me?.source ?? "self"]} · {days.me ? time(days.me.at) : ""}</span>
          </span>
          <Button variant="text" style={{ color: "var(--duo-green-text)", textDecoration: "underline" }} disabled={busy} onClick={() => mark.mutate({ mode: "none" }, { onError: fail })}>Change</Button>
        </div>
      ) : (
        <button type="button" className="duo-btn duo-btn-p duo-checkin" disabled={busy} aria-busy={busy} onClick={office}>
          {busy && step !== "ask" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><LoaderCircle size={24} className="duo-spin" aria-hidden="true" />Checking…</span> : <><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Building2 size={22} aria-hidden="true" />I'm in the office</span><small>tap to mark today</small></>}
        </button>
      )}
      {mode !== "office" && (
        <Button variant="ghost" style={{ width: "100%" }} aria-pressed={mode === "remote"} disabled={busy} onClick={mode === "remote" ? () => mark.mutate({ mode: "none" }, { onError: fail }) : remote}>
          {mode === "remote" ? <><Check size={18} aria-hidden="true" />Remote today · tap to undo</> : "Working remote today"}
        </Button>
      )}

      {(step === "ask" || step === "locating") && (
        <Sheet label="Location check" onClose={() => setStep(null)}>
          <Explain icon={<MapPin size={22} />} tone="sky" title="Quick check that you're at the office">You're not on office Wi-Fi, so we need your location once to mark an office day. It's checked against the office and not stored as a trail.</Explain>
          <Button style={{ width: "100%" }} disabled={busy} onClick={withLocation}>{step === "locating" ? <><LoaderCircle size={18} className="duo-spin" aria-hidden="true" />Checking…</> : <><MapPin size={18} aria-hidden="true" />Allow location</>}</Button>
          <Button variant="ghost" style={{ width: "100%" }} disabled={busy} onClick={remote}>Working remote today</Button>
          <Flat style={{ padding: 12 }}><span className="duo-sub" style={{ fontSize: 12 }}>On office Wi-Fi you're never asked: the network is the proof.</span></Flat>
        </Sheet>
      )}
      {step === "outside" && (
        <Sheet label="Not at the office" onClose={() => setStep(null)}>
          <Explain icon={<MapPin size={22} />} tone="pink" title="You don't look like you're at the office">Your location puts you {distance ? `about ${km(distance)} away` : "outside the office"}, so today can't be marked as an office day from here.</Explain>
          <Button style={{ width: "100%" }} disabled={busy} onClick={remote}>Working remote today</Button>
          <Button variant="ghost" style={{ width: "100%" }} disabled={busy} onClick={withLocation}>Try again</Button>
          <Flat style={{ padding: 12 }}><span className="duo-sub" style={{ fontSize: 12 }}>At your desk and it still won't verify? Join office Wi-Fi and try again, or ask an admin to fix your day.</span></Flat>
        </Sheet>
      )}
      {step === "blocked" && (
        <Sheet label="Location blocked" onClose={() => setStep(null)}>
          <Explain icon={<Lock size={22} />} tone="gold" title="We couldn't get your location">Location is blocked or unavailable for this site. Join office Wi-Fi and tap again, or allow location for this site in your browser settings.</Explain>
          <Button style={{ width: "100%" }} disabled={busy} onClick={withLocation}>Try again</Button>
          <Button variant="ghost" style={{ width: "100%" }} disabled={busy} onClick={remote}>Working remote today</Button>
          <Flat style={{ padding: 12 }}><span className="duo-sub" style={{ fontSize: 12 }}>Remote days never need your location.</span></Flat>
        </Sheet>
      )}
    </>
  );
}
