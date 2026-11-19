"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getJSON, send } from "@/lib/fetcher";

export type PushState = "unsupported" | "off" | "on" | "denied";

// base64url → Uint8Array, the form PushManager wants for the VAPID key.
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Web Push for this browser: whether it is on, and how to turn it on or off.
export function usePush() {
  const [state, setState] = useState<PushState>("unsupported");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return setState("off");
        // Re-register so the server links the subscription to whoever is signed in now.
        const res = await send("/api/push", { method: "POST", json: sub.toJSON() });
        setState(res.ok ? "on" : "off");
      })
      .catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    const config = await getJSON<{ enabled: boolean; publicKey: string | null }>("/api/push", "push settings");
    if (!config?.enabled || !config.publicKey) return toast.error("Push isn't set up yet.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return toast.error("Notifications are blocked in your browser settings.");
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.publicKey) });
    const res = await send("/api/push", { method: "POST", json: sub.toJSON() });
    if (!res.ok) return toast.error("Couldn't turn on notifications.");
    setState("on");
    toast.success("Notifications on for this device");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const res = await send("/api/push", { method: "DELETE", json: { endpoint: sub.endpoint } });
      if (!res.ok) return toast.error("Couldn't turn off notifications. Try again.");
      await sub.unsubscribe();
    }
    setState("off");
    toast.success("Notifications off for this device");
  }

  return { state, enable, disable };
}
