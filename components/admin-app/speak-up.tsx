"use client";
// Admin › Speak up: reported Feed posts first (Keep clears the reports, Remove deletes the post),
// then the anonymous messages with the status and note their sender sees.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { useAllGrievances, useKeepPost, useRemovePost, useReported, useSetGrievance, type Grievance, type ReportedPost } from "@/lib/queries";
import { Chips, Loading, PageHead, dayLabel, istDay, todayIST, useSnack } from "./ui";

type Status = Grievance["status"];
const STATUS: [Status, string, string, string][] = [["open", "New", "#D3E5F5", "#0C1D29"], ["in_progress", "In progress", "#FFDDB0", "#4A2800"], ["resolved", "Resolved", "#CDEBD6", "#0B3D1F"]];
type Filter = "open" | "resolved" | "all";
const day = (iso: string) => (istDay(iso) === todayIST() ? "Today" : dayLabel(istDay(iso)));

export function SpeakUpPage() {
  const list = useAllGrievances();
  const reported = useReported();
  const params = useSearchParams();
  const router = useRouter();
  const filter = (["open", "resolved", "all"] as const).find((f) => f === params.get("show")) ?? "open";
  if (!list.data) return <><PageHead title="Speak up" /><Loading what="Speak up" error={list.error} onRetry={() => list.refetch()} /></>;
  const all = [...list.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = all.filter((g) => g.status !== "resolved").length;
  const shown = all.filter((g) => filter === "all" || (filter === "open" ? g.status !== "resolved" : g.status === "resolved"));
  const posts = reported.data ?? [];
  return (
    <>
      <PageHead title="Speak up" />
      <div className="m3a-cols">
        <div className="m3a-main" style={{ maxWidth: 760 }}>
          {posts.length > 0 && (
            <section aria-label="Reported posts" className="m3a-card m3a-flush">
              <h2 className="m3-title" style={{ padding: "16px 20px 8px" }}>Reported posts · {posts.length}</h2>
              <ul className="m3a-list m3a-topline">{posts.map((p) => <Reported key={p.id} post={p} />)}</ul>
            </section>
          )}
          <Chips label="Filter messages" value={filter} onPick={(f: Filter) => router.replace(f === "open" ? "/admin/speak-up" : `/admin/speak-up?show=${f}`, { scroll: false })}
            options={[["open", `Open ${open}`], ["resolved", `Resolved ${all.length - open}`], ["all", `All ${all.length}`]]} />
          {shown.map((g) => <Message key={g.id} g={g} />)}
          {shown.length === 0 && <div className="m3a-card"><p className="m3-body" style={{ margin: 0, color: "var(--m3-on-surface-variant)" }}>Nothing here.</p></div>}
        </div>
      </div>
    </>
  );
}

function Reported({ post }: { post: ReportedPost }) {
  const keep = useKeepPost();
  const remove = useRemovePost();
  const snack = useSnack();
  const author = post.authorName ?? "Anonymous";
  const whose = post.authorName ? `${post.authorName}'s post` : "the anonymous post";
  const busy = keep.isPending || remove.isPending;
  return (
    <li style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="m3-small">{author} · {day(post.createdAt)}</span>
      <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.title ? `${post.title}: ` : ""}{post.body}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" className="m3-btn m3-btn-text" aria-label={`Keep ${whose}`} disabled={busy} onClick={() => keep.mutate({ id: post.id }, { onSuccess: () => snack("Post kept"), onError: (e) => snack(e.message) })}>Keep</button>
        <button type="button" className="m3-btn m3a-btn-danger" aria-label={`Remove ${whose}`} disabled={busy} onClick={() => remove.mutate({ id: post.id }, { onSuccess: () => snack("Post removed from the Feed"), onError: (e) => snack(e.message) })}>Remove post</button>
      </div>
    </li>
  );
}

function Message({ g }: { g: Grievance }) {
  const set = useSetGrievance();
  const snack = useSnack();
  const saved = g.reply ?? "";
  const [draft, setDraft] = useState(saved);
  const [, label, bg, fg] = STATUS.find(([k]) => k === g.status)!;
  const unchanged = draft.trim() === saved;
  return (
    <article className="m3a-card" aria-label={`${g.topic ?? "Message"} from ${day(g.createdAt)}`} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {g.topic && <span className="m3a-tag" style={{ border: "1px solid #71787E", color: "#181C20" }}>{g.topic}</span>}
        <span className="m3-small">{day(g.createdAt)}</span>
        <span style={{ flex: 1 }} />
        <span className="m3a-tag" style={{ background: bg, color: fg }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{g.body}</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span id={`sq-${g.id}`} className="m3a-lbl">Status they see</span>
        <div role="radiogroup" aria-labelledby={`sq-${g.id}`} className="m3a-seg">
          {STATUS.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={g.status === k} disabled={set.isPending}
              onClick={() => g.status !== k && set.mutate({ id: g.id, status: k }, { onSuccess: () => snack(`Status set to ${l}`), onError: (e) => snack(e.message) })}>
              {g.status === k && <Check size={16} strokeWidth={2.2} aria-hidden="true" />}{l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="m3a-fcol" style={{ flex: "1 1 240px" }}>
          <label htmlFor={`sn-${g.id}`} className="m3a-lbl">Note the sender sees</label>
          <input id={`sn-${g.id}`} className="m3a-field" maxLength={1000} value={draft} placeholder="For example: Facilities are looking at it this week" onChange={(e) => setDraft(e.target.value)} />
        </div>
        <button type="button" className="m3-btn m3-btn-outlined" style={{ height: 44, flex: "none" }} disabled={unchanged || set.isPending}
          onClick={() => set.mutate({ id: g.id, reply: draft.trim() || null }, { onSuccess: () => snack(draft.trim() ? "Note saved" : "Note removed"), onError: (e) => snack(e.message) })}>Save note</button>
      </div>
      {saved && <span className="m3-small">They see: “{saved}”</span>}
    </article>
  );
}
