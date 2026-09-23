"use client";

import { useEffect, useState } from "react";
import { Gauge, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { WifiArt } from "@/components/art";
import { Empty, PageHeader, QualityDot, stagger } from "@/components/kit";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { StatefulButton } from "@/components/motion/button/stateful";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { useButtonState } from "@/lib/hooks/use-button-state";
import { fmtTime, relativeDay, relativeTime } from "@/lib/format";

type Report = { id: string; quality: "good" | "poor"; note: string; downMbps: number | null; createdAt: string };

const PAYLOAD_BYTES = 2 * 1024 * 1024;

// Times a 2 MB download. Non-OK responses (e.g. 429) must never be mistaken for a measurement.
async function measureDownload(): Promise<{ mbps: number } | { error: string }> {
  const start = performance.now();
  const res = await send(`/api/wifi/speedtest?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return { error: await readError(res) };
  const bytes = (await res.arrayBuffer()).byteLength;
  if (bytes < PAYLOAD_BYTES) return { error: "Speed test was interrupted — try again." };
  const seconds = (performance.now() - start) / 1000;
  return { mbps: Math.round(((bytes * 8) / seconds / 1_000_000) * 10) / 10 };
}

export default function Wifi() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [testState, runTest] = useButtonState();

  const load = async () => {
    const data = await getJSON<Report[]>("/api/wifi", "Wi-Fi reports");
    if (data) setReports(data);
  };

  const checkSpeed = () =>
    runTest(async () => {
      const result = await measureDownload();
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }
      setSpeed(result.mbps);
      return true;
    });

  useEffect(() => {
    load();
    // Home's "Check Speed" links here with ?check=1 — run the test straight away.
    if (new URLSearchParams(window.location.search).get("check") === "1") {
      window.history.replaceState(null, "", "/wifi");
      checkSpeed();
    }
  }, []);

  async function report(quality: "good" | "poor") {
    setBusy(true);
    const res = await send("/api/wifi", { method: "POST", json: { quality, note, downMbps: speed } });
    if (res.ok) {
      toast.success("Thanks — report submitted.");
      setNote("");
      setSpeed(null);
      await load();
    } else {
      toast.error(await readError(res));
    }
    setBusy(false);
  }

  const latest = reports?.[0];

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Wi-Fi Quality"
        subtitle="Is the Wi-Fi working well? Report any issues or check the current network quality."
      />

      {!reports ? (
        <Card className="items-center gap-3 p-6">
          <Skeleton className="size-28 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </Card>
      ) : (
        <div className="t-stagger">
          <Card className="gap-0 p-6 text-center" style={stagger(0)}>
            <WifiArt quality={latest?.quality ?? null} />
            <p
              className={`mt-3 text-lg font-medium ${
                !latest ? "text-muted-foreground" : latest.quality === "good" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {!latest ? "No reports yet" : latest.quality === "good" ? "Good" : "Poor"}
            </p>
            <p className="text-xs text-muted-foreground">
              {latest ? `Reported ${relativeTime(latest.createdAt).toLowerCase()}` : "Be the first to report how it's doing."}
            </p>

            <StatefulButton
              variant="secondary"
              state={testState}
              onClick={checkSpeed}
              loadingText="Measuring"
              successText="Measured"
              errorText="Failed"
              icon={<Gauge className="size-4" />}
              className="mt-5 h-11 w-full rounded-lg bg-secondary font-medium text-accent-foreground"
            >
              {speed != null ? "Check again" : "Check Speed"}
            </StatefulButton>
            {speed != null && (
              <p className="mt-3 text-sm text-muted-foreground">
                Download{" "}
                <AnimatedNumber
                  value={speed}
                  format={(n) => n.toFixed(1)}
                  startOnView={false}
                  className="text-lg font-medium tabular-nums text-foreground"
                />{" "}
                Mbps
              </p>
            )}
          </Card>

          <Card className="mt-4 gap-0 p-5" style={stagger(1)}>
            <p className="text-sm font-medium">How&apos;s the Wi-Fi right now?</p>
            <Input
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional) — e.g. slow near the meeting room"
              aria-label="Note"
              className="mt-3"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="outline" size="xl" disabled={busy} onClick={() => report("good")} className="hover:border-emerald-300 hover:text-emerald-700">
                <ThumbsUp /> Good
              </Button>
              <Button variant="outline" size="xl" disabled={busy} onClick={() => report("poor")} className="hover:border-rose-300 hover:text-rose-700">
                <ThumbsDown /> Poor
              </Button>
            </div>
          </Card>

          <Card className="mt-4 gap-0 p-5" style={stagger(2)}>
            <p className="text-sm font-medium">Recent Reports</p>
            {reports.length === 0 ? (
              <Empty>Nothing reported yet.</Empty>
            ) : (
              <ul className="mt-1 divide-y">
                {reports.slice(0, 10).map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {relativeDay(r.createdAt)} · {fmtTime(r.createdAt)}
                        {r.downMbps != null && <span className="opacity-70"> · {r.downMbps} Mbps</span>}
                      </span>
                      <QualityDot quality={r.quality} />
                    </div>
                    {r.note && <p className="mt-1 text-sm">{r.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
