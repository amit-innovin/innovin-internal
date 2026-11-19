"use client";
// The Wi-Fi speed test: fast.com's nearest node first, our own payload as the fallback.
import { readError, send } from "@/lib/fetcher";

// Stop after this much — enough to get past TCP slow start without wasting anyone's data.
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_SECONDS = 8;

// Times a response body from the first byte onwards. Starting the clock before the request
// would count connection setup and server latency as transfer time, which badly understates
// fast links: a small payload can finish in less time than the round trip takes.
async function timeBody(res: Response, requestStart: number) {
  if (!res.body) throw new Error("no body");

  const reader = res.body.getReader();
  let total = 0;
  let firstChunk = 0;
  let firstByteAt = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      if (!firstByteAt) {
        firstByteAt = performance.now();
        firstChunk = value.byteLength;
      }
      total += value.byteLength;
      if (total >= MAX_BYTES || performance.now() - firstByteAt > MAX_SECONDS * 1000) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!firstByteAt || total === 0) throw new Error("no data");

  // Normally: time the bytes that arrived *after* the first chunk, so connection setup and
  // server latency are excluded. If the body came down in a single chunk (small payloads,
  // or a local server) there's nothing left to time, so fall back to the whole request —
  // less precise, but a number beats an error.
  const streamed = total - firstChunk;
  const [bytes, seconds] =
    streamed > 0
      ? [streamed, (performance.now() - firstByteAt) / 1000]
      : [total, (performance.now() - requestStart) / 1000];
  if (seconds <= 0) throw new Error("too fast to measure");
  return Math.round(((bytes * 8) / seconds / 1_000_000) * 10) / 10;
}

type Measurement = { mbps: number; via: string | null };

// Prefer fast.com's nearest Netflix node — it measures the office's actual internet speed.
// Our own endpoint is the fallback, and only really measures the hop to our server.
export async function measureDownload(): Promise<Measurement | { error: string }> {
  // `send` rather than getJSON: an unavailable fast.com is an expected, silent fallback, not
  // something to toast about.
  const lookup = await send("/api/wifi/speedtest/targets");
  const fast = lookup.ok ? ((await lookup.json()) as { targets?: string[]; city?: string | null }) : null;

  for (const url of fast?.targets ?? []) {
    try {
      const startedAt = performance.now();
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(String(res.status));
      return { mbps: await timeBody(res, startedAt), via: fast?.city ? `fast.com · ${fast.city}` : "fast.com" };
    } catch {
      // Try the next node, then our own payload.
    }
  }

  const startedAt = performance.now();
  const res = await send(`/api/wifi/speedtest?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) return { error: await readError(res) };
  try {
    return { mbps: await timeBody(res, startedAt), via: null };
  } catch {
    return { error: "Speed test was interrupted — try again." };
  }
}
