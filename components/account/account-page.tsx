"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, CircleHelp, LogOut, MessageSquare, ShieldCheck, Wifi, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Flat, PageHeader, QueryState, Split, Toggle } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Sheet } from "@/components/duo/sheet";
import { readError, send } from "@/lib/fetcher";
import { useAccount, useSend, useSetOfficeDays, type Account } from "@/lib/queries";
import { usePush } from "@/lib/use-push";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const birthdayLabel = (mmdd: string) => `${Number(mmdd.slice(3))} ${MONTHS[Number(mmdd.slice(0, 2)) - 1]}`;

async function signOut() {
  const res = await send("/api/auth/logout", { method: "POST" });
  if (!res.ok) return toast.error(await readError(res));
  window.location.assign("/");
}

function Setting({ title, desc, checked, onChange, disabled }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>{title}</span>
        <span className="duo-sub" style={{ fontSize: 13 }}>{desc}</span>
      </span>
      <Toggle checked={checked} label={title} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function OfficeDays({ account }: { account: Account }) {
  const save = useSetOfficeDays();
  const [days, setDays] = useState(account.officeDays);
  const flip = (i: number) => {
    const next = days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort();
    setDays(next);
    save.mutate(next, { onError: (e) => { setDays(account.officeDays); toast.error(e.message); } });
  };
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>My office days</span>
      <span className="duo-sub" style={{ fontSize: 13 }}>Teammates see who’s expected each day.</span>
      <div role="group" aria-label="My office days" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {WEEKDAYS.map((label, i) => <button key={label} type="button" className="duo-chip" aria-pressed={days.includes(i)} onClick={() => flip(i)}>{label}</button>)}
      </div>
    </Card>
  );
}

function BirthdaySheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const [month, setMonth] = useState(account.birthday ? Number(account.birthday.slice(0, 2)) : 1);
  const [day, setDay] = useState(account.birthday ? Number(account.birthday.slice(3)) : 1);
  const save = useSend<{ birthday: string | null; showBirthday: boolean }, Account>(["account"], "/api/account", "PATCH", { replace: true, also: [["feed"]] });
  const mmdd = `${String(month).padStart(2, "0")}-${String(Math.min(day, DAYS_IN[month - 1])).padStart(2, "0")}`;
  return (
    <Sheet label="Your birthday" onClose={onClose}>
      <h2 className="duo-h2" style={{ fontSize: 22 }}>Your birthday</h2>
      <span className="duo-sub">Day and month only, never the year. It shows on the Feed on the day.</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Day</span>
          <select className="duo-input" value={Math.min(day, DAYS_IN[month - 1])} onChange={(e) => setDay(Number(e.target.value))}>{Array.from({ length: DAYS_IN[month - 1] }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Month</span>
          <select className="duo-input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        </label>
      </div>
      <Button disabled={save.isPending} onClick={() => save.mutate({ birthday: mmdd, showBirthday: true }, { onSuccess: () => { toast.success("Birthday saved"); onClose(); }, onError: (e) => toast.error(e.message) })}>Show my birthday</Button>
      {account.birthday && <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ birthday: null, showBirthday: false }, { onSuccess: () => { toast.success("Birthday removed"); onClose(); }, onError: (e) => toast.error(e.message) })}>Remove it</Button>}
    </Sheet>
  );
}

function Prefs({ account }: { account: Account }) {
  const push = usePush();
  const [editing, setEditing] = useState(false);
  const save = useSend<{ birthday: string | null; showBirthday: boolean }, Account>(["account"], "/api/account", "PATCH", { replace: true, also: [["feed"]] });
  const pushDesc = push.state === "unsupported" ? "This browser can’t show push alerts" : push.state === "denied" ? "Blocked in your browser settings" : "Tea time, events, leave decisions";
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Setting title="Show my birthday" desc={account.birthday ? `${birthdayLabel(account.birthday)} · day and month only` : "Day and month only · not set yet"} checked={account.showBirthday} disabled={save.isPending}
        onChange={(on) => (account.birthday ? save.mutate({ birthday: account.birthday, showBirthday: on }, { onError: (e) => toast.error(e.message) }) : setEditing(true))} />
      {account.birthday && <Button variant="text" style={{ alignSelf: "flex-start", marginTop: -10, minHeight: 32, padding: 0 }} onClick={() => setEditing(true)}>Change date</Button>}
      <div style={{ height: 2, background: "var(--duo-line)" }} />
      <Setting title="Notifications" desc={pushDesc} checked={push.state === "on"} disabled={push.state === "unsupported" || push.state === "denied"} onChange={(on) => (on ? push.enable() : push.disable())} />
      {editing && <BirthdaySheet account={account} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function LinkRow({ href, Icon, title, desc }: { href: string; Icon: LucideIcon; title: string; desc: string }) {
  return (
    <Link href={href} className="duo-row" style={{ padding: "12px 14px" }}>
      <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
      <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 17, fontWeight: 600 }}>{title}</span>
        <span className="duo-sub" style={{ fontSize: 13 }}>{desc}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function AccountPage({ needsYou }: { needsYou: number | null }) {
  const account = useAccount();
  const head = <PageHeader title="Account" subtitle="Your profile and settings" actions={<BellLink />} />;
  const a = account.data;
  if (!a) return <Split head={head}><QueryState error={account.error} onRetry={() => account.refetch()} what="your account" /></Split>;
  return (
    <Split head={head}>
      <Card style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Avatar name={a.name} size={64} />
        <span style={{ flex: "1 1 160px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 22, fontWeight: 700 }}>{a.name}</span>
          <span className="duo-sub" style={{ overflowWrap: "anywhere" }}>{a.email} · {a.role === "admin" ? "Admin" : "Member"}</span>
        </span>
        <span className="duo-wide-only"><a href="/api/auth/google?next=/account" className="duo-btn duo-btn-g" style={{ minHeight: 44, fontSize: 14 }}>Switch Google account</a></span>
      </Card>

      {needsYou !== null && (
        <Link href="/admin" className="duo-btn duo-peek" style={{ background: "var(--duo-hero)", color: "#fff", boxShadow: "0 5px 0 var(--duo-ink)" }}>
          <span className="duo-tile" style={{ background: "var(--duo-gold)", color: "var(--duo-ink)" }} aria-hidden="true"><ShieldCheck size={22} /></span>
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Admin</span>
            <span style={{ fontFamily: "var(--duo-body)", fontSize: 13, fontWeight: 800, color: "var(--duo-hero-muted)" }}>{needsYou ? `${needsYou} thing${needsYou === 1 ? "" : "s"} need${needsYou === 1 ? "s" : ""} you` : "All clear"}</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      )}

      <OfficeDays key={a.officeDays.join(",")} account={a} />
      <Prefs account={a} />

      <div className="duo-phone-only" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <LinkRow href="/grievances" Icon={MessageSquare} title="Speak up" desc="Report something, anonymously" />
        <LinkRow href="/wifi" Icon={Wifi} title="Wi-Fi check" desc="Test the office connection" />
        <LinkRow href="/help" Icon={CircleHelp} title="Help" desc="How things work" />
        <Button variant="ghost" onClick={signOut} style={{ color: "var(--duo-pink-text)" }}><LogOut size={18} aria-hidden="true" />Sign out</Button>
      </div>
      <Flat className="duo-wide-only"><span className="duo-sub" style={{ fontSize: 13 }}>Speak up, Wi-Fi check, Help and Sign out are in the account menu at the bottom of the sidebar.</span></Flat>
    </Split>
  );
}
