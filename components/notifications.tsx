"use client";
import { LoadRecovery } from "@/components/load-recovery";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Coffee, CalendarDays, CalendarOff, Megaphone, MessageCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Empty } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { getJSON, send } from "@/lib/fetcher";
import { relativeTime } from "@/lib/format";

type Item = { id: string; kind: "announcement" | "event" | "away" | "grievance" | "ping" | "pantry"; title: string; body: string; at: string; href: string };
type Feed = { items: Item[]; unread: number };

const ICON = { announcement: Megaphone, event: CalendarDays, away: CalendarOff, grievance: MessageSquare, ping: MessageCircle, pantry:Coffee };

// base64url → Uint8Array, the form PushManager wants for the VAPID key.
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// The bell is mounted twice — once in the desktop sidebar, once in the mobile top bar — since
// each is hidden at the other breakpoint and there's no shared header. Only one is ever visible,
// but both mount; the fetcher dedupes in-flight GETs and caches briefly, so that's one request.
export default function Notifications() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<"unsupported" | "off" | "on" | "denied">("unsupported");
  const panel = useRef<HTMLDivElement>(null);

  const load = async () => {
    const data = await getJSON<Feed>("/api/notifications", "your notifications", { fresh: true });
    if (data) setFeed(data);
    return data;
  };

  useEffect(() => {
    load();
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return setPushState("denied");
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return setPushState("off");
        const res = await send("/api/push", { method: "POST", json: sub.toJSON() });
        setPushState(res.ok ? "on" : "off");
      })
      .catch(() => setPushState("unsupported"));
  }, []);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  // Close on outside click, so the panel behaves like a menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    // Opening marks what's visible as read.
    if (next) {
      const current = await load();
      if (current?.unread) {
        const res = await send("/api/notifications", { method: "POST" });
        if (res.ok) setFeed({ ...current, unread: 0 });
        else toast.error("Couldn't mark updates as read. Try again.");
      }
    }
  }

  async function enablePush() {
    const config = await getJSON<{ enabled: boolean; publicKey: string | null }>("/api/push", "push settings");
    if (!config?.enabled || !config.publicKey) return toast.error("Push isn't set up yet.");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushState(permission === "denied" ? "denied" : "off");
      return toast.error("Notifications are blocked in your browser settings.");
    }

    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
    const res = await send("/api/push", { method: "POST", json: sub.toJSON() });
    if (!res.ok) return toast.error("Couldn't turn on notifications.");
    setPushState("on");
    toast.success("Notifications on for this device");
  }

  async function disablePush() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const res = await send("/api/push", { method: "DELETE", json: { endpoint: sub.endpoint } });
      if (!res.ok) return toast.error("Couldn't turn off notifications. Try again.");
      await sub.unsubscribe();
    }
    setPushState("off");
    toast.success("Notifications off for this device");
  }

  const unread = feed?.unread ?? 0;

  return (
    <div ref={panel} className="relative">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={toggleOpen}
        className="relative rounded-full text-muted-foreground"
      >
        {unread > 0 ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent-foreground text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-4 top-[calc(3.5rem+env(safe-area-inset-top))] z-50 overflow-hidden rounded-xl border bg-card shadow-lift md:absolute md:left-0 md:right-auto md:top-full md:mt-1 md:w-80"
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <p className="text-sm font-medium">Notifications</p>
            {pushState === "off" && (
              <button type="button" onClick={enablePush} className="text-xs font-medium text-accent-foreground hover:underline">
                Turn on
              </button>
            )}
            {pushState === "on" && (
              <button type="button" onClick={disablePush} className="text-xs text-muted-foreground hover:underline">
                Turn off
              </button>
            )}
            {pushState === "denied" && <span className="text-xs text-muted-foreground">Blocked in browser</span>}
          </div>

          {!feed ? (<LoadRecovery>
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          </LoadRecovery>) : feed.items.length === 0 ? (
            <Empty>Nothing new in the last month.</Empty>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {feed.items.map((item) => {
                const Icon = ICON[item.kind];
                return (
                  <li key={item.id}>
                    <Link href={item.href} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-accent/40">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        {item.body && <p className="truncate text-xs text-muted-foreground">{item.body}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{relativeTime(item.at)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
