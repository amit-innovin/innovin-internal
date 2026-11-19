"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { readError, send } from "@/lib/fetcher";
import { useDays } from "@/lib/queries";
import { measureDownload } from "@/lib/speedtest";
import { wifiVerdict } from "@/lib/wifi-rules";

const AREAS = ["Desk area", "Meeting room", "Pantry", "Balcony"];
const MIN_MS = 8000;
type Result = { down: number; up: number; delayMs: number };

async function measureUpload(): Promise<number> {
  const payload = new Uint8Array(1_500_000);
  const start = performance.now();
  const res = await fetch("/api/wifi/upload", { method: "POST", body: payload, headers: { "Content-Type": "application/octet-stream" } });
  if (!res.ok) throw new Error("upload failed");
  const seconds = (performance.now() - start) / 1000;
  return Math.round(((payload.length * 8) / seconds / 1_000_000) * 10) / 10;
}

async function measureDelay(): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await fetch(`/api/wifi/ping?${i}-${Date.now()}`, { cache: "no-store" });
    times.push(performance.now() - start);
  }
  return Math.round(times.sort((a, b) => a - b)[2]);
}

// "While you wait: catch the packets." Just for fun; the test runs either way.
function Packets({ onCatch, caught }: { onCatch: () => void; caught: number }) {
  const [pos, setPos] = useState({ x: 40, y: 40 });
  useEffect(() => {
    const t = setInterval(() => setPos({ x: 8 + Math.round(Math.random() * 78), y: 10 + Math.round(Math.random() * 70) }), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="m3-stack" style={{ gap: 6 }}>
      <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}>While you wait: catch the packets</span>
      <div style={{ position: "relative", height: 180, borderRadius: 16, background: "var(--m3-surface-container)", overflow: "hidden" }}>
        <button type="button" aria-label="Catch the packet" onClick={onCatch}
          style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, width: 44, height: 44, borderRadius: 12, border: 0, background: "var(--m3-primary)", color: "var(--m3-on-primary)", fontWeight: 700, cursor: "pointer", transition: "left .3s ease, top .3s ease" }}>01</button>
      </div>
      <span className="m3-small" aria-live="polite">{caught} caught · Just for fun. The test runs either way.</span>
    </div>
  );
}

// Wi-Fi check from the Material 3 prototype: run it, see a plain verdict, and (from the office)
// tell admins where it's slow. Reports keep no identity; only the result and the area.
export function WifiPage() {
  const params = useSearchParams();
  const router = useRouter();
  const days = useDays();
  const client = useQueryClient();
  const inOffice = days.data?.me?.mode === "office";
  const [state, setState] = useState<"idle" | "running" | "done" | "sent">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [caught, setCaught] = useState(0);
  const [reportAnyway, setReportAnyway] = useState(false);
  const [area, setArea] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const started = useRef(false);

  const run = async () => {
    setState("running"); setCaught(0); setResult(null); setReportAnyway(false); setArea(null); setNote("");
    const begin = performance.now();
    const down = await measureDownload();
    const [up, delayMs] = await Promise.all([measureUpload().catch(() => 0), measureDelay().catch(() => 999)]);
    const wait = MIN_MS - (performance.now() - begin);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    setResult({ down: "mbps" in down ? down.mbps : 0, up, delayMs });
    setState("done");
  };

  useEffect(() => {
    if (params.get("check") === "1" && !started.current) {
      started.current = true;
      router.replace("/wifi", { scroll: false });
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const verdict = result ? wifiVerdict(result) : null;
  const canReport = inOffice && (verdict === "slow" || reportAnyway);

  const sendReport = async () => {
    if (!result) return;
    setSending(true);
    const res = await send("/api/wifi", { method: "POST", json: { quality: verdict === "slow" ? "poor" : "good", downMbps: result.down, upMbps: result.up, area, note: note.trim() } });
    setSending(false);
    if (!res.ok) return toast.error(await readError(res));
    await client.invalidateQueries({ queryKey: ["wifi"] });
    setState("sent");
  };

  return (
    <div className="m3 m3-page m3-stack">
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <Link href="/" className="m3-btn m3-btn-text" aria-label="Back to home" style={{ width: 44, padding: 0 }}><ArrowLeft size={22} aria-hidden="true" /></Link>
        <h1 className="m3-h1" style={{ fontSize: 28, lineHeight: "36px" }}>Wi-Fi check</h1>
      </header>
      <section className="m3-card m3-stack" style={{ gap: 12 }}>
        <p className="m3-body" style={{ margin: 0 }}>Tests the connection you&apos;re on right now: download, upload and delay. It takes about 10 seconds.</p>
        {state === "idle" && (
          <>
            <span className="m3-small">{inOffice ? "You're checked in, so you can report a problem to admins." : "You're not checked in. The check still runs, but reports are for the office Wi-Fi only."}</span>
            <Button className="m3-btn-lg" onClick={run}>Run check</Button>
          </>
        )}
        {state === "running" && (
          <>
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 10 }}><LoaderCircle size={20} className="m3-spin" aria-hidden="true" />Testing download, upload and delay…</div>
            <Packets caught={caught} onCatch={() => setCaught((n) => n + 1)} />
          </>
        )}
      </section>

      {(state === "done" || state === "sent") && result && (
        <section aria-labelledby="wifi-verdict" className="m3-card m3-stack" style={{ gap: 10, background: verdict === "slow" ? "var(--m3-warn-container)" : "var(--m3-success-container)" }}>
          <h2 id="wifi-verdict" className="m3-title">{verdict === "slow" ? "The connection is slow right now" : "The connection looks good"}</h2>
          <span className="m3-small" style={{ color: "inherit" }}>You caught {caught} packet{caught === 1 ? "" : "s"} while you waited.</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {[[result.down, "Mbps down"], [result.up, "Mbps up"], [result.delayMs, "ms delay"]].map(([n, label]) => (
              <span key={label as string} style={{ display: "flex", flexDirection: "column" }}><b style={{ fontSize: 24, fontVariantNumeric: "tabular-nums" }}>{n}</b><span className="m3-small" style={{ color: "inherit" }}>{label}</span></span>
            ))}
          </div>
        </section>
      )}

      {state === "done" && verdict === "slow" && !inOffice && <p className="m3-small" style={{ margin: "0 4px" }}>Check in to report office Wi-Fi problems.</p>}
      {state === "done" && verdict === "good" && inOffice && !reportAnyway && (
        <p className="m3-small" style={{ margin: "0 4px" }}>Looks fine from here. Calls still dropping? <button type="button" className="m3-btn m3-btn-text" style={{ height: 32, padding: "0 4px" }} onClick={() => setReportAnyway(true)}>Report anyway</button></p>
      )}

      {state === "done" && canReport && (
        <section aria-labelledby="wifi-report" className="m3-card m3-stack" style={{ gap: 12 }}>
          <h2 id="wifi-report" className="m3-title">Report it to admins</h2>
          <span className="m3-small">Your result is attached. Where are you sitting?</span>
          <div role="radiogroup" aria-label="Where are you sitting?" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {AREAS.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={area === a} onClick={() => setArea(a)}
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", border: area === a ? 0 : "1px solid var(--m3-outline)", background: area === a ? "var(--m3-secondary-container)" : "transparent", color: area === a ? "var(--m3-on-secondary-container)" : "var(--m3-on-surface-variant)" }}>{a}</button>
            ))}
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}>Anything else? (optional)</span>
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} style={{ height: 44, borderRadius: 12, border: "1px solid var(--m3-outline)", padding: "0 12px", fontFamily: "inherit", fontSize: 15, background: "var(--m3-surface)" }} />
          </label>
          <Button disabled={sending} onClick={sendReport}>Send report</Button>
        </section>
      )}

      {state === "sent" && (
        <section className="m3-card m3-stack" style={{ gap: 8 }} role="status">
          <h2 className="m3-title">Sent to admins with your result</h2>
        </section>
      )}
      {(state === "done" || state === "sent") && <Button variant="outlined" style={{ alignSelf: "flex-start" }} onClick={run}>Run again</Button>}
    </div>
  );
}
