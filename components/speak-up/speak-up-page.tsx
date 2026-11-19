"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, EyeOff, MailX, MonitorX, ShieldCheck } from "lucide-react";
import { SpeakUpIcon } from "@/components/m3/icons";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { fetchJSON, readError, send } from "@/lib/fetcher";
import type { GrievanceStatus } from "@/lib/types";

type Mine = { id: string; body: string; status: GrievanceStatus; topic?: string | null; reply?: string | null; createdAt: string };
const TOPICS = ["Workplace", "People", "Facilities", "Process", "Something else"];
const ref = (id: string) => `SU-${id.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()}`;
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const statusLine = (g: Mine) => (g.status === "resolved" ? "Resolved" : g.status === "in_progress" ? "In progress" : g.reply ? "Replied" : `Sent ${day(g.createdAt)} · no reply yet`);

// Speak up from the Material 3 prototype: a private, anonymous message to admins. Admins see the
// topic, the message and the day; never a name, email, device or time. It works signed out too.
export function SpeakUpPage({ name: _name }: { name: string | null }) {
  const client = useQueryClient();
  const mine = useQuery({ queryKey: ["grievances", "mine"], queryFn: () => fetchJSON<Mine[]>("/api/grievances?scope=mine") });
  const [topic, setTopic] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sentRef, setSentRef] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    const res = await send("/api/grievances", { method: "POST", json: { body: text.trim(), topic } });
    setSending(false);
    if (!res.ok) return toast.error(await readError(res));
    const row = (await res.json()) as Mine;
    setSentRef(ref(row.id)); setText(""); setTopic(null);
    client.invalidateQueries({ queryKey: ["grievances", "mine"] });
  };

  const chip = (on: boolean) => ({ height: 40, padding: "0 16px", borderRadius: 20, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", border: on ? "1px solid var(--m3-speak)" : "1px solid var(--m3-outline-variant)", background: on ? "var(--m3-speak)" : "var(--m3-surface)", color: on ? "#FFFFFF" : "var(--m3-on-surface)" });
  return (
    <div className="m3 m3-page pg-wide m3-stack">
      <header className="su-hero">
        <Link href="/" className="m3-icon-btn m3-back" aria-label="Back to home" style={{ color: "#FFFFFF", marginLeft: -10 }}><ArrowLeft size={22} aria-hidden="true" /></Link>
        <div className="pg-head-text">
          <span className="pg-eyebrow" style={{ color: "#C9C6D6" }}><SpeakUpIcon size={16} />Anonymous by design</span>
          <h1 className="pg-h1">Speak up</h1>
          <span className="pg-sub">Say what&apos;s not working, privately. Admins read it and can reply here, without ever knowing it was you.</span>
        </div>
        <div className="su-promises" aria-label="What admins never see">
          <span className="su-promise"><EyeOff size={15} aria-hidden="true" />No name</span>
          <span className="su-promise"><MailX size={15} aria-hidden="true" />No email</span>
          <span className="su-promise"><MonitorX size={15} aria-hidden="true" />No device</span>
          <span className="su-promise"><CalendarDays size={15} aria-hidden="true" />The day, never the time</span>
        </div>
      </header>

      <div className="pg-cols">
        <div className="pg-main">
          {sentRef ? (
            <section role="status" className="pg-card" style={{ gap: 10, alignItems: "flex-start" }}>
              <span className="m3-icon m3-tone-success"><ShieldCheck size={20} aria-hidden="true" /></span>
              <b style={{ fontSize: 20 }}>Sent anonymously</b>
              <span className="m3-body">Reference {sentRef}. If an admin replies, it shows under My reports. Only this device can see your reports.</span>
              <Button variant="outlined" onClick={() => setSentRef(null)}>Write another</Button>
            </section>
          ) : (
            <section className="pg-card" style={{ gap: 16 }}>
              <span className="m3-title">What&apos;s it about?</span>
              <div role="group" aria-label="Topic" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TOPICS.map((t) => (
                  <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? null : t)} style={chip(topic === t)}>{t}</button>
                ))}
              </div>
              <label htmlFor="speak" className="m3-title">What&apos;s going on?</label>
              <textarea id="speak" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Write it the way you'd say it. Leave out details that would identify you if you want to stay anonymous."
                style={{ minHeight: 200, padding: "14px 16px", lineHeight: "24px", borderRadius: 16, border: "1px solid var(--m3-outline)", fontFamily: "inherit", fontSize: 16, background: "var(--m3-ground)", resize: "vertical" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span className="m3-small">{text.length}/2000</span>
                <Button className="m3-btn-lg" disabled={!text.trim() || sending} onClick={submit} style={{ background: "var(--m3-speak)", minWidth: 220 }}>Send anonymously</Button>
              </div>
              <p className="m3-small" style={{ margin: 0 }}>Something serious, like harassment or a safety issue? You can also go straight to HR.</p>
            </section>
          )}
        </div>

        <aside className="pg-rail">
          <section aria-label="What admins see" className="pg-card" style={{ gap: 10 }}>
            <b>What admins see</b>
            <span className="m3-body">The topic, your message and the day it was sent. That&apos;s all.</span>
            <span className="m3-small">Your reports live on this device only, so replies reach you without an account trail.</span>
          </section>
          {(mine.data?.length ?? 0) > 0 && (
            <section aria-labelledby="my-reports" className="td-sec">
              <div className="td-sech"><h2 id="my-reports">My reports</h2></div>
              <div className="pg-card pg-flush">
                {mine.data!.map((g) => (
                  <div key={g.id} className="m3-row" style={{ alignItems: "flex-start" }}>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{g.topic ?? "General"} · {ref(g.id)}</span>
                      <span className="m3-small">{statusLine(g)}</span>
                      {g.reply && <span className="m3-body" style={{ marginTop: 6, padding: "10px 12px", borderRadius: 14, background: "var(--m3-surface-container)" }}><b>Reply from admins:</b> {g.reply}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
