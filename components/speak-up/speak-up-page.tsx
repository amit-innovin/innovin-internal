"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Card, PageHeader, Pill, Split, Toggle, type Tone } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { fetchJSON, readError, send } from "@/lib/fetcher";
import type { GrievanceStatus } from "@/lib/types";

const MAX = 500;
type Mine = { id: string; body: string; status: GrievanceStatus; createdAt: string };
const STATUS: Record<GrievanceStatus, [string, Tone]> = { open: ["Open", "sky"], in_progress: ["In progress", "gold"], resolved: ["Resolved", "green"] };

// Works signed out too (the page is public), so the name comes from the server when there is one.
export function SpeakUpPage({ name }: { name: string | null }) {
  const [anon, setAnon] = useState(true);
  const [body, setBody] = useState("");
  const [typedName, setTypedName] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const mine = useQuery({ queryKey: ["grievances", "mine"], queryFn: () => fetchJSON<Mine[]>("/api/grievances?scope=mine") });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return toast.error("Tell us what’s on your mind");
    const displayName = anon ? null : (name ?? typedName.trim());
    if (!anon && !displayName) return toast.error("Add your name, or stay anonymous");
    setBusy(true);
    const res = await send("/api/grievances", { method: "POST", json: { body, displayName, image: null, urgent } });
    setBusy(false);
    if (!res.ok) return toast.error(await readError(res));
    setBody("");
    setUrgent(false);
    toast.success(urgent ? "Sent and marked urgent. Admins get a push alert." : "Thank you. We’ll look into it.");
    client.invalidateQueries({ queryKey: ["grievances", "mine"] });
  };

  const reports = (
    <Card style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14 }} id="mine">
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>Your reports on this device</span>
      <span className="duo-sub" style={{ fontSize: 12 }}>Only this browser can see this list.</span>
      {mine.isError && <span className="duo-sub" role="alert">{mine.error.message}</span>}
      {mine.data?.length === 0 && <span className="duo-sub" style={{ fontSize: 13, paddingTop: 6 }}>Nothing sent from here yet.</span>}
      {mine.data?.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: "2px solid var(--duo-line)" }}>
          <span style={{ fontSize: 14, fontWeight: 700, flexGrow: 1, lineHeight: 1.35, overflowWrap: "anywhere" }}>{r.body.length > 120 ? `${r.body.slice(0, 120)}…` : r.body}</span>
          <Pill tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Pill>
        </div>
      ))}
    </Card>
  );

  return (
    <Split head={<PageHeader title="Speak up" subtitle="Something broken or unfair? Tell us. Anonymous by default." actions={name ? <BellLink /> : undefined} back={name ? { href: "/account", label: "Back to account" } : undefined} />} rail={reports}>
      <Card>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>Stay anonymous</span>
              <span className="duo-sub" style={{ fontSize: 13 }}>{anon ? "No name, no email, no device link. Ever." : name ? `Sent as ${name}.` : "Your name goes with it."}</span>
            </span>
            <Toggle checked={anon} label="Stay anonymous" onChange={setAnon} />
          </div>
          {!anon && !name && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Your name</span>
              <input className="duo-input" value={typedName} maxLength={100} onChange={(e) => setTypedName(e.target.value)} /></label>
          )}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="duo-label">What’s up?</span>
            <textarea className="duo-textarea" value={body} maxLength={MAX} onChange={(e) => setBody(e.target.value)} placeholder="Tell us what’s broken or unfair" />
            <span className="duo-sub" style={{ fontSize: 12, textAlign: "right" }}>{body.length}/{MAX}</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>This is urgent</span>
              <span className="duo-sub" style={{ fontSize: 13 }}>Admins get a push alert.</span>
            </span>
            <Toggle checked={urgent} label="This is urgent" onChange={setUrgent} />
          </div>
          <Button type="submit" disabled={busy || !body.trim()} style={{ width: "100%", minHeight: 52, fontSize: 18 }}>{busy ? "Sending…" : anon ? "Send anonymously" : "Send with my name"}</Button>
        </form>
      </Card>
    </Split>
  );
}
