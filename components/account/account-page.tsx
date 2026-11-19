"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, ListRow, QueryState } from "@/components/m3";
import { PageHero } from "@/components/m3/hero";
import { Sheet } from "@/components/m3/sheet";
import { readError, send } from "@/lib/fetcher";
import { useAccount } from "@/lib/queries";
import { useSayHiSetting } from "@/components/home/say-hi";
import { usePush } from "@/lib/use-push";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const usually = (days: number[]) => {
  const names = [...days].sort((a, b) => a - b).map((d) => DAY[d]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}` : names[0];
};

async function signOut() {
  const res = await send("/api/auth/logout", { method: "POST" });
  if (!res.ok) return toast.error(await readError(res));
  window.location.assign("/");
}

function NotificationSettings({ sayHi, onClose }: { sayHi: boolean; onClose: () => void }) {
  const push = usePush();
  const setSayHi = useSayHiSetting();
  const on = push.state === "on";
  return (
    <Sheet open onClose={onClose} label="Notification settings">
      <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>Notification settings</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600 }}>Notifications on this device</span>
          <span className="m3-small">Tea round, events, kudos, leave decisions</span>
        </span>
        <button type="button" role="switch" aria-checked={on} aria-label="Notifications on this device" disabled={push.state === "unsupported" || push.state === "denied"}
          onClick={() => (on ? push.disable() : push.enable())}
          style={{ flex: "none", width: 52, height: 32, borderRadius: 16, border: on ? 0 : "2px solid #71787E", background: on ? "var(--m3-primary)" : "#DFE3E8", padding: 0, position: "relative", cursor: "pointer" }}>
          <span style={{ position: "absolute", top: "50%", left: on ? 24 : 6, width: on ? 24 : 16, height: on ? 24 : 16, borderRadius: 12, background: on ? "#FFFFFF" : "#71787E", transform: "translateY(-50%)" }} />
        </button>
      </div>
      {push.state === "denied" && <p className="m3-small" style={{ margin: 0 }}>Notifications are blocked for this site in your browser settings.</p>}
      {push.state === "unsupported" && <p className="m3-small" style={{ margin: 0 }}>This browser can&apos;t show notifications. Add the app to your home screen to get them.</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600 }}>Say hi</span>
          <span className="m3-small">Waves and invites from people in the office. Only people who turn it on can send or get them.</span>
        </span>
        <button type="button" role="switch" aria-checked={sayHi} aria-label="Say hi" disabled={setSayHi.isPending} onClick={() => setSayHi.mutate(!sayHi)}
          style={{ flex: "none", width: 52, height: 32, borderRadius: 16, border: sayHi ? 0 : "2px solid #71787E", background: sayHi ? "var(--m3-primary)" : "#DFE3E8", padding: 0, position: "relative", cursor: "pointer" }}>
          <span style={{ position: "absolute", top: "50%", left: sayHi ? 24 : 6, width: sayHi ? 24 : 16, height: sayHi ? 24 : 16, borderRadius: 12, background: sayHi ? "#FFFFFF" : "#71787E", transform: "translateY(-50%)" }} />
        </button>
      </div>
      <p className="m3-small" style={{ margin: 0 }}>Grievance updates are never sent as notifications.</p>
    </Sheet>
  );
}

// Account from the Material 3 prototype: deliberately plain. Office days live in Days, Speak up
// is its own button, Wi-Fi is on Home, and birthdays are entered by admins.
export function AccountPage() {
  const account = useAccount();
  const [settings, setSettings] = useState(false);
  const a = account.data;
  if (!a) return <div className="m3 m3-page m3-stack"><PageHero page="account" title="Account" /><QueryState error={account.error} onRetry={() => account.refetch()} what="your account" /></div>;
  return (
    <div className="m3 m3-page m3-stack">
      <PageHero page="account" title={a.name} actions={<Avatar name={a.name} size={48} />}>
        {a.officeDays.length > 0 && <span className="m3-chip m3-chip-neutral" style={{ alignSelf: "flex-start" }}>Usually in {usually(a.officeDays)}</span>}
      </PageHero>
      <div className="m3-card" style={{ padding: 0, overflow: "hidden" }}>
        <ListRow onClick={() => setSettings(true)} title="Notification settings" subtitle="Tea round, events, kudos" chevron />
        <ListRow href="/help" title="Help" chevron />
        {a.role === "admin" && <ListRow href="/admin" title="Admin" subtitle="Opens the admin app" chevron />}
        <button type="button" className="m3-row" onClick={signOut} style={{ color: "var(--m3-error)", fontWeight: 600 }}>Sign out</button>
      </div>
      {settings && <NotificationSettings sayHi={a.sayHi} onClose={() => setSettings(false)} />}
    </div>
  );
}
