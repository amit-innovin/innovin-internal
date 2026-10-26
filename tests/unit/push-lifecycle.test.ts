import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(async (_subscription: unknown, _payload: string, _options: unknown) => undefined), list: vi.fn(), remove: vi.fn(async () => true) }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: mocks.send } }));
vi.mock("@/lib/store", () => ({ store: { listPushSubscriptions: mocks.list, deletePushSubscription: mocks.remove } }));
import { sendPush } from "@/lib/push";
import { createUserSession, pushSession } from "@/lib/auth";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("keeps private content out of push payloads and refuses expired or legacy associations", async () => {
  vi.stubEnv("VAPID_PUBLIC_KEY", "public"); vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  const base = { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "key", auth: "auth", email: "a@innovinlabs.com", createdAt: new Date().toISOString() };
  mocks.list.mockResolvedValue([base, { ...base, sessionRef: "expired", sessionExpiresAt: new Date(0).toISOString() }, { ...base, sessionRef: "valid", sessionExpiresAt: new Date(Date.now()+60000).toISOString() }]);
  const result = await sendPush({ title: "Private sender", body: "Confidential HR detail", href: "/attendance" }, base.email);
  expect(result.sent).toBe(1);
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(JSON.parse(mocks.send.mock.calls[0][1] as string)).toEqual({ title: "Innovin Internal", body: "Open the app to check your updates.", href: "/", tag: "private-update" });
});
it("derives an opaque session binding without storing the authentication token", () => {
  vi.stubEnv("SESSION_SECRET", "test-secret");
  const token = createUserSession({ email: "a@innovinlabs.com", name: "A" })!;
  const binding = pushSession(token)!;
  expect(binding.sessionRef).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(binding)).not.toContain(token);
  expect(pushSession("forged")).toBeNull();
});
