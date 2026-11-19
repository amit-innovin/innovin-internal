"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import type { Feed } from "@/lib/feed";
import { usePostNotice } from "@/lib/queries";

export type Kind = "kudos" | "poll" | "quote" | "feedback";
const KINDS: [Kind, string, string][] = [
  ["kudos", "Kudos", "Thank someone in public. No points."],
  ["poll", "Poll", "Ask a quick question with options."],
  ["quote", "Quote", "Share a line that stuck with you."],
  ["feedback", "Feedback", "Public, with your name. For anonymous, use Speak up."],
];

const inDays = (n: number) => new Date(Date.now() + 5.5 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);
const field = { width: "100%", minHeight: 48, borderRadius: 12, border: "1px solid var(--m3-outline)", padding: "10px 12px", fontFamily: "inherit", fontSize: 15, background: "var(--m3-surface)", boxSizing: "border-box" as const };

function Field({ label, value, onChange, multiline, max }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; max: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}>{label}</span>
      {multiline ? <textarea rows={3} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...field, resize: "vertical" }} />
        : <input maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} style={field} />}
    </label>
  );
}

// "New post": kudos, poll, quote or feedback. Events and announcements come from admins, and
// anonymous posts belong in Speak up, so neither is offered here.
export function Composer({ people, start, onClose }: { people: Feed["people"]; start?: { kind: Kind; to?: string }; onClose: () => void }) {
  const post = usePostNotice();
  const [kind, setKind] = useState<Kind | null>(start?.kind ?? null);
  const [to, setTo] = useState(start?.to ?? "");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [by, setBy] = useState("");
  const valid = kind === "kudos" ? !!to && !!text.trim()
    : kind === "poll" ? !!text.trim() && options.every((o) => o.trim()) && options[0].trim().toLowerCase() !== options[1].trim().toLowerCase()
    : !!text.trim();
  const toName = people.find((p) => p.email === to)?.name;
  const shown = people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8);

  const submit = () => {
    if (!kind || !valid) return;
    const body = kind === "kudos" ? { kind, toEmail: to, body: text.trim() }
      : kind === "poll" ? { kind, title: text.trim(), options: options.map((o) => o.trim()), closesOn: inDays(3) }
      : { kind, body: text.trim(), attribution: kind === "quote" ? by.trim() : "", title: "", color: "purple", anonymous: false };
    post.mutate(body, { onSuccess: () => { toast.success("Posted"); onClose(); }, onError: (e) => toast.error(e.message) });
  };

  return (
    <Sheet open onClose={onClose} label="New post">
      <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>New post</h2>
      {!kind ? (
        <>
          <div className="m3-card" style={{ padding: 0, overflow: "hidden", background: "var(--m3-surface-container)" }}>
            {KINDS.map(([k, label, line]) => (
              <button key={k} type="button" className="m3-row" onClick={() => setKind(k)}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", textAlign: "left" }}><span style={{ fontWeight: 600 }}>{label}</span><span className="m3-small">{line}</span></span>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            ))}
          </div>
          <span className="m3-small">Events and announcements are posted by admins.</span>
        </>
      ) : (
        <div className="m3-stack" style={{ gap: 12 }}>
          <span className="m3-small">{KINDS.find(([k]) => k === kind)![2]}</span>
          {kind === "kudos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}>To</span>
              {to ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="m3-chip m3-chip-neutral">{toName}</span>
                  <Button variant="text" onClick={() => setTo("")}>Change</Button>
                </div>
              ) : (
                <>
                  <input aria-label="Search people" placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} style={field} />
                  <div role="group" aria-label="To" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {shown.map((p) => <button key={p.email} type="button" className="m3-btn m3-btn-outlined" style={{ height: 36, padding: "0 12px", fontSize: 14 }} onClick={() => setTo(p.email)}>{p.name}</button>)}
                    {shown.length === 0 && <span className="m3-small">Nobody by that name.</span>}
                  </div>
                </>
              )}
            </div>
          )}
          <Field label={kind === "kudos" ? "What did they do?" : kind === "poll" ? "Your question" : kind === "quote" ? "The quote" : "Your feedback"} value={text} onChange={setText} multiline={kind !== "poll"} max={kind === "poll" ? 140 : kind === "kudos" ? 500 : 2000} />
          {kind === "poll" && options.map((o, i) => <Field key={i} label={`Option ${i + 1}`} value={o} max={60} onChange={(v) => setOptions((all) => all.map((x, j) => (j === i ? v : x)))} />)}
          {kind === "quote" && <Field label="Who said it? (optional)" value={by} onChange={setBy} max={120} />}
          {kind === "poll" && <span className="m3-small">The poll closes in 3 days. Results show to each person after they vote.</span>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {!start && <Button variant="text" onClick={() => setKind(null)}>Back</Button>}
            {start && <Button variant="text" onClick={onClose}>Cancel</Button>}
            <Button disabled={!valid || post.isPending} onClick={submit}>Post</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
