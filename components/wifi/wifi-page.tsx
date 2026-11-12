"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, Wifi, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, PageHeader, Pill, Split } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { readError, send } from "@/lib/fetcher";
import { relativeTime } from "@/lib/format";
import { useWifiReports } from "@/lib/queries";
import { measureDownload } from "@/lib/speedtest";

type Test = { state: "ready" } | { state: "testing" } | { state: "done"; mbps: number; via: string | null };

export function WifiPage() {
  const reports = useWifiReports();
  const client = useQueryClient();
  const [test, setTest] = useState<Test>({ state: "ready" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const run = async () => {
    setTest({ state: "testing" });
    const result = await measureDownload();
    if ("error" in result) { toast.error(result.error); setTest({ state: "ready" }); return; }
    setTest({ state: "done", mbps: result.mbps, via: result.via });
  };

  // Home's Wi-Fi button links here with ?check=1: run the test straight away.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (new URLSearchParams(window.location.search).get("check") === "1") {
      window.history.replaceState(null, "", "/wifi");
      run();
    }
  }, []);

  const report = async (quality: "good" | "poor") => {
    setBusy(true);
    const res = await send("/api/wifi", { method: "POST", json: { quality, note, downMbps: test.state === "done" ? test.mbps : null } });
    setBusy(false);
    if (!res.ok) return toast.error(await readError(res));
    toast.success(quality === "good" ? "Thanks. Glad it’s working." : "Thanks. Admins will take a look.");
    setNote("");
    client.invalidateQueries({ queryKey: ["wifi"] });
  };

  const recent = (
    <Card style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14 }}>
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>Recent reports</span>
      {reports.isError && <span className="duo-sub" role="alert">{reports.error.message}</span>}
      {reports.data?.length === 0 && <span className="duo-sub" style={{ fontSize: 13 }}>No reports yet.</span>}
      {reports.data?.slice(0, 8).map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "2px solid var(--duo-line)" }}>
          <Pill tone={r.quality === "good" ? "green" : "pink"}>{r.quality === "good" ? "Good" : "Poor"}</Pill>
          <span style={{ fontSize: 14, fontWeight: 700, flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>{[r.note, r.downMbps != null ? `${Math.round(r.downMbps)} Mbps` : ""].filter(Boolean).join(" · ") || "No details"}</span>
          <span className="duo-sub" style={{ fontSize: 12, flexShrink: 0 }}>{relativeTime(r.createdAt)}</span>
        </div>
      ))}
    </Card>
  );

  return (
    <Split head={<PageHeader title="Wi-Fi check" subtitle="Test the office connection, flag it if it’s bad." actions={<BellLink />} back={{ href: "/account", label: "Back to account" }} />} rail={recent}>
      <section aria-label="Speed test" style={{ background: "var(--duo-hero)", borderRadius: 24, padding: "28px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, color: "#fff" }}>
        <div aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: test.state === "done" ? 72 : 44, fontWeight: 700, lineHeight: 1 }}>
            {test.state === "done" ? Math.round(test.mbps) : test.state === "testing" ? "Testing…" : "Ready"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--duo-hero-muted)" }}>
            {test.state === "done" ? `Mbps down · measured just now${test.via ? ` · ${test.via}` : ""}` : test.state === "testing" ? "Downloading a test file" : "Takes about 8 seconds"}
          </span>
        </div>
        <button type="button" className="duo-btn" disabled={test.state === "testing"} onClick={run} style={{ background: "#fff", color: "var(--duo-hero)", boxShadow: "0 4px 0 var(--duo-hero-muted)", minHeight: 52, fontSize: 18 }}>
          {test.state === "testing" ? <LoaderCircle size={18} className="duo-spin" aria-hidden="true" /> : <Wifi size={18} aria-hidden="true" />}
          {test.state === "done" ? "Run the test again" : test.state === "testing" ? "Measuring…" : "Check speed"}
        </button>
      </section>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>How’s it feeling?</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <button type="button" className="duo-btn duo-tone-green duo-tonebtn" disabled={busy} onClick={() => report("good")} style={{ borderColor: "var(--duo-green-edge)", boxShadow: "0 4px 0 var(--duo-green-edge)", minHeight: 52, fontSize: 18 }}><Check size={18} aria-hidden="true" />Good</button>
          <button type="button" className="duo-btn duo-tone-pink duo-tonebtn" disabled={busy} onClick={() => report("poor")} style={{ borderColor: "var(--duo-pink-edge)", boxShadow: "0 4px 0 var(--duo-pink-edge)", minHeight: 52, fontSize: 18 }}><X size={18} aria-hidden="true" />Poor</button>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="duo-label">Where are you? (optional)</span>
          <input className="duo-input" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Meeting room, 3rd floor" />
        </label>
      </Card>
    </Split>
  );
}
