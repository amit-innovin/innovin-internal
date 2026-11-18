"use client";
// Admin › Publish: announcements (each shows once to everyone as a dialog; optional pin to the
// top of the Feed) and events. Seen counts are counts, never names.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  useAdminOverview, useAnnouncements, useCancelEvent, useDeleteAnnouncement, useDeleteEvent, useEvents, usePostEvent, usePublishAnnouncement,
  type AdminAnnouncement, type AdminEvent,
} from "@/lib/queries";
import { Loading, PageHead, Switch, Tabs, dayLabel, fmtTime, istDay, todayIST, useSnack } from "./ui";

type Tab = "announcements" | "events";
const CATS: [string, string, string, string][] = [
  ["social", "Celebration", "#FFD9E2", "#3F0017"], ["culture", "Culture", "#FFF1C2", "#3D2E00"], ["learning", "Learning", "#D3E5F5", "#0C1D29"],
  ["sports", "Sports", "#CDEBD6", "#0B3D1F"], ["arts", "Arts", "#EBDCFF", "#20142F"], ["company", "Company", "#E5E8EE", "#41474D"],
];
const cat = (c: string) => CATS.find(([k]) => k === c) ?? CATS[5];

export function PublishPage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("tab") === "events" ? "events" : "announcements";
  return (
    <>
      <PageHead title="Publish" />
      <Tabs label="What to publish" value={tab} onPick={(t) => router.replace(t === "events" ? "/admin/publish?tab=events" : "/admin/publish", { scroll: false })}
        options={[["announcements", "Announcements"], ["events", "Events"]]} />
      {tab === "announcements" ? <Announcements /> : <Events />}
    </>
  );
}

function Confirm({ text, onKeep, onDelete, busy }: { text: string; onKeep: () => void; onDelete: () => void; busy: boolean }) {
  return (
    <div role="group" aria-label="Confirm delete" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#FFDAD6", color: "#410002", borderRadius: 16, padding: "10px 12px" }}>
      <span style={{ flex: 1, minWidth: 160, fontSize: 14 }}>{text}</span>
      <button type="button" className="m3-btn m3-btn-text" style={{ color: "#410002" }} onClick={onKeep}>Keep</button>
      <button type="button" className="m3-btn m3a-btn-danger" disabled={busy} onClick={onDelete}>Delete</button>
    </div>
  );
}

function Announcements() {
  const list = useAnnouncements();
  const overview = useAdminOverview();
  const publish = usePublishAnnouncement();
  const del = useDeleteAnnouncement();
  const snack = useSnack();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [until, setUntil] = useState("");
  const [confirm, setConfirm] = useState("");
  const today = todayIST();
  const untilBad = !!until && until < today;
  const cant = !title.trim() || !body.trim() || untilBad || publish.isPending;
  const total = overview.data?.total;
  const submit = () => publish.mutate({ title: title.trim(), body: body.trim(), ...(until ? { pinnedUntil: until } : {}) }, {
    onSuccess: () => { setTitle(""); setBody(""); setUntil(""); snack("Published"); },
    onError: (e) => snack(e.message),
  });
  return (
    <div className="m3a-cols">
      <section aria-labelledby="an-h" className="m3a-half m3a-card">
        <h2 id="an-h" className="m3-title">New announcement</h2>
        <div className="m3a-fcol"><label htmlFor="an-t" className="m3a-lbl">Title</label><input id="an-t" className="m3a-field" maxLength={120} placeholder="Office closed on Friday" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="m3a-fcol"><label htmlFor="an-b" className="m3a-lbl">Message</label><textarea id="an-b" className="m3a-field" maxLength={500} placeholder="What people need to know" value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="m3a-fcol"><label htmlFor="an-u" className="m3a-lbl">Pin to the top of the Feed until (optional)</label><input id="an-u" type="date" className="m3a-field" min={today} value={until} onChange={(e) => setUntil(e.target.value)} /></div>
        {untilBad && <p role="alert" className="m3a-alert">Pick today or a later date.</p>}
        <div><button type="button" className="m3-btn m3-btn-filled" disabled={cant} onClick={submit}>Publish announcement</button></div>
      </section>
      <section aria-labelledby="al-h" className="m3a-half m3a-card m3a-flush" style={{ gap: 0 }}>
        <h2 id="al-h" className="m3-title" style={{ padding: "16px 20px 8px" }}>Published</h2>
        {!list.data ? <div style={{ padding: "4px 20px 20px" }}><Loading what="announcements" error={list.error} onRetry={() => list.refetch()} /></div> : list.data.length === 0
          ? <p className="m3-body" style={{ margin: 0, padding: "4px 20px 20px", color: "var(--m3-on-surface-variant)" }}>Nothing published.</p>
          : list.data.map((a: AdminAnnouncement) => (
            <div key={a.id} className="m3a-topline" style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{a.title}</div><div className="m3-small">Posted {istDay(a.createdAt) === today ? "today" : dayLabel(istDay(a.createdAt))}</div></div>
                {confirm !== a.id && <button type="button" className="m3-btn m3-btn-text" aria-label={`Delete ${a.title}`} style={{ flex: "none" }} onClick={() => setConfirm(a.id)}>Delete</button>}
              </div>
              {a.body && <p className="m3-body" style={{ margin: 0, color: "var(--m3-on-surface-variant)", whiteSpace: "pre-wrap" }}>{a.body}</p>}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {a.pinnedUntil && <span className="m3a-tag" style={{ background: "#FFDDB0", color: "#4A2800" }}>Pinned until {dayLabel(a.pinnedUntil)}</span>}
                <span style={{ flex: 1 }} />
                {total !== undefined && <span style={{ fontSize: 14, fontWeight: 600 }}>Seen by {a.seen ?? 0} of {total}</span>}
              </div>
              {confirm === a.id && <Confirm text="Delete it from everyone's app?" busy={del.isPending} onKeep={() => setConfirm("")}
                onDelete={() => del.mutate({ action: "delete", id: a.id }, { onSuccess: () => { setConfirm(""); snack(`“${a.title}” deleted`); }, onError: (e) => snack(e.message) })} />}
            </div>
          ))}
      </section>
    </div>
  );
}

function Events() {
  const list = useEvents();
  const post = usePostEvent();
  const cancel = useCancelEvent();
  const del = useDeleteEvent();
  const snack = useSnack();
  const today = todayIST();
  const [f, setF] = useState({ title: "", date: "", time: "", place: "", cat: "social" });
  const [confirm, setConfirm] = useState("");
  const dateBad = !!f.date && f.date < today;
  const cant = !f.title.trim() || !f.date || dateBad || !f.time || !f.place.trim() || post.isPending;
  const submit = () => post.mutate({ title: f.title.trim(), category: f.cat, startsAt: `${f.date}T${f.time}`, body: "", location: f.place.trim() }, {
    onSuccess: () => { setF({ title: "", date: "", time: "", place: "", cat: "social" }); snack("Posted"); },
    onError: (e) => snack(e.message),
  });
  const events = [...(list.data ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="m3a-cols">
      <section aria-labelledby="ev-h" className="m3a-half m3a-card">
        <h2 id="ev-h" className="m3-title">New event</h2>
        <div className="m3a-fcol"><label htmlFor="ev-t" className="m3a-lbl">Title</label><input id="ev-t" className="m3a-field" maxLength={120} placeholder="Diwali potluck" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="m3a-fcol" style={{ flex: "1 1 160px" }}><label htmlFor="ev-d" className="m3a-lbl">Date</label><input id="ev-d" type="date" className="m3a-field" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="m3a-fcol" style={{ flex: "1 1 120px" }}><label htmlFor="ev-tm" className="m3a-lbl">Time (IST)</label><input id="ev-tm" type="time" className="m3a-field" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        </div>
        {dateBad && <p role="alert" className="m3a-alert">Pick today or a later date.</p>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="m3a-fcol" style={{ flex: "2 1 200px" }}><label htmlFor="ev-p" className="m3a-lbl">Place</label><input id="ev-p" className="m3a-field" maxLength={80} placeholder="Big room" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></div>
          <div className="m3a-fcol" style={{ flex: "1 1 140px" }}><label htmlFor="ev-c" className="m3a-lbl">Category</label>
            <select id="ev-c" className="m3a-field" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
        </div>
        {/* Google Calendar invites come in Stage 8b; the switch is drawn and stays off until then. */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span id="ev-g" style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>Invite everyone in Google Calendar</span>
          <Switch labelledBy="ev-g" on={false} disabled onToggle={() => {}} />
        </div>
        <div><button type="button" className="m3-btn m3-btn-filled" disabled={cant} onClick={submit}>Post event</button></div>
      </section>
      <section aria-labelledby="el-h" className="m3a-half m3a-card m3a-flush" style={{ gap: 0 }}>
        <h2 id="el-h" className="m3-title" style={{ padding: "16px 20px 8px" }}>Upcoming events</h2>
        {!list.data ? <div style={{ padding: "4px 20px 20px" }}><Loading what="events" error={list.error} onRetry={() => list.refetch()} /></div> : events.length === 0
          ? <p className="m3-body" style={{ margin: 0, padding: "4px 20px 20px", color: "var(--m3-on-surface-variant)" }}>No events coming up.</p>
          : events.map((e: AdminEvent) => {
            const date = istDay(e.startsAt);
            const [, catLabel, bg, fg] = cat(e.category);
            const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(e.startsAt));
            return (
              <div key={e.id} className="m3a-topline" style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span aria-hidden="true" style={{ flex: "none", width: 52, borderRadius: 14, background: "#EBEEF4", textAlign: "center", padding: "6px 0" }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#41474D", lineHeight: "16px" }}>{dayLabel(date, { month: "short" })}</span>
                    <span style={{ display: "block", fontSize: 20, fontWeight: 700, lineHeight: "24px" }}>{Number(date.slice(8))}</span>
                  </span>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontWeight: 600 }}>{e.title}</span><span className="m3a-tag" style={{ background: bg, color: fg }}>{catLabel}</span></div>
                    <span className="m3-small">{dayLabel(date)} · {fmtTime(time)}{e.location ? ` · ${e.location}` : ""}</span>
                    <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)", paddingTop: 2 }}>{e.cancelledAt ? "Cancelled" : `${e.going} going`}</span>
                  </div>
                </div>
                {confirm !== e.id ? (
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {!e.cancelledAt && e.canManage && <button type="button" className="m3-btn m3-btn-outlined" aria-label={`Cancel ${e.title}`} disabled={cancel.isPending}
                      onClick={() => cancel.mutate({ id: e.id, expectedUpdatedAt: e.updatedAt ?? e.createdAt }, { onSuccess: () => snack(`${e.title} cancelled`), onError: (err) => snack(err.message) })}>Cancel event</button>}
                    <button type="button" className="m3-btn m3-btn-text" aria-label={`Delete ${e.title}`} onClick={() => setConfirm(e.id)}>Delete</button>
                  </div>
                ) : <Confirm text="Delete it? It disappears without a notification. Cancel tells people." busy={del.isPending} onKeep={() => setConfirm("")}
                  onDelete={() => del.mutate({ action: "delete", id: e.id }, { onSuccess: () => { setConfirm(""); snack(`${e.title} deleted`); }, onError: (err) => snack(err.message) })} />}
              </div>
            );
          })}
      </section>
    </div>
  );
}
