import webpush from "web-push";
import { store } from "./store";
import { validPushEndpoint } from "./push-endpoint";

// Web Push delivery. Sending is best-effort and never blocks the action that triggered it: a
// failed notification must not fail an approval or a published announcement.
//
// Nothing here can send a grievance update — by design there is no way to look up which
// subscription submitted one (see PushSubscriptionRow).

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function configure() {
  if (configured || !pushConfigured()) return pushConfigured();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@innovinlabs.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

export type PushMessage = { title: string; body: string; href: string; tag?: string };

// `to` is an email to reach one person's devices, or undefined to broadcast.
export async function sendPush(message: PushMessage, to?: string) {
  if (!configure()) return { sent: 0, removed: 0 };

  const subs = await store.listPushSubscriptions(to);
  // Private content is fetched only after opening the authenticated app. Queued pushes
  // can arrive after logout, so never put a private name, message or HR decision in them.
  const payload = JSON.stringify(to ? { title: "Innovin Internal", body: "Open the app to check your updates.", href: "/", tag: "private-update" } : message);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (s) => {
      if (!validPushEndpoint(s.endpoint)) return;
      if (to && (!s.sessionRef || !s.sessionExpiresAt || !Number.isFinite(Date.parse(s.sessionExpiresAt)) || Date.parse(s.sessionExpiresAt) <= Date.now())) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { timeout: 5000, TTL: to ? 60 : 3600 });
        sent += 1;
      } catch (err) {
        // 404/410 mean the browser dropped the subscription — prune it so the list doesn't rot.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await store.deletePushSubscription(s.endpoint);
          removed += 1;
        }
      }
    }),
  );

  return { sent, removed };
}
