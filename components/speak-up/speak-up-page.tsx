"use client";
import { WorkspaceLink as Link } from "@/components/m3/workspace-link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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

  return (
    <div className="m3 m3-page m3-stack">
      <header style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 0" }}>
        <Link href="/" className="m3-btn m3-btn-text" aria-label="Back to home" style={{ width: 44, padding: 0 }}><ArrowLeft size={22} aria-hidden="true" /></Link>
        <h1 className="m3-h1" style={{ fontSize: 28, lineHeight: "36px" }}>Speak up</h1>
      </header>
      <section className="m3-card" style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--m3-secondary-container)", color: "var(--m3-on-secondary-container)" }}>
        <ShieldCheck size={24} aria-hidden="true" style={{ flex: "none" }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <b>Anonymous by design</b>
          <span className="m3-body" style={{ color: "inherit" }}>Admins see the topic and your message. They don&apos;t see your name, email or device, and the date shows only the day, not the time.</span>
        </span>
      </section>

      {sentRef ? (
        <section role="status" className="m3-card m3-stack" style={{ gap: 8 }}>
          <b>Sent anonymously</b>
          <span className="m3-body">Reference {sentRef}. If an admin replies, it shows under My reports. Only this device can see your reports.</span>
          <Button variant="outlined" style={{ alignSelf: "flex-start" }} onClick={() => setSentRef(null)}>Write another</Button>
        </section>
      ) : (
        <section className="m3-stack" style={{ gap: 12 }}>
          <span className="m3-title" style={{ padding: "0 4px" }}>What&apos;s it about?</span>
          <div role="group" aria-label="Topic" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TOPICS.map((t) => (
              <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? null : t)}
                style={{ height: 36, padding: "0 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", border: topic === t ? "1px solid var(--m3-secondary-container)" : "1px solid var(--m3-outline)", background: topic === t ? "var(--m3-secondary-container)" : "transparent", color: topic === t ? "var(--m3-on-secondary-container)" : "var(--m3-on-surface-variant)" }}>{t}</button>
            ))}
          </div>
          <label htmlFor="speak" className="m3-title" style={{ padding: "0 4px" }}>What&apos;s going on?</label>
          <textarea id="speak" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Write it the way you'd say it. Leave out details that would identify you if you want to stay anonymous."
            style={{ height: 160, padding: "12px 14px", lineHeight: "22px", borderRadius: 12, border: "1px solid var(--m3-outline)", fontFamily: "inherit", fontSize: 15, background: "var(--m3-surface)", resize: "vertical" }} />
          <Button className="m3-btn-lg" disabled={!text.trim() || sending} onClick={submit}>Send anonymously</Button>
          <p className="m3-small" style={{ margin: 0 }}>Something serious, like harassment or a safety issue? You can also go straight to HR.</p>
        </section>
      )}

      {(mine.data?.length ?? 0) > 0 && (
        <section aria-labelledby="my-reports" className="m3-stack" style={{ gap: 8 }}>
          <h2 id="my-reports" className="m3-title" style={{ padding: "0 4px" }}>My reports</h2>
          <div className="m3-card" style={{ padding: 0, overflow: "hidden" }}>
            {mine.data!.map((g) => (
              <div key={g.id} className="m3-row" style={{ alignItems: "flex-start" }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>{g.topic ?? "General"} · {ref(g.id)}</span>
                  <span className="m3-small">{statusLine(g)}</span>
                  {g.reply && <span className="m3-body" style={{ marginTop: 4, padding: "8px 10px", borderRadius: 12, background: "var(--m3-surface-container)" }}><b>Reply from admins:</b> {g.reply}</span>}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
