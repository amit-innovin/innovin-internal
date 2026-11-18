"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJSON, readError, send } from "@/lib/fetcher";
import type { DaysView } from "@/lib/days";
import type { Notification } from "@/lib/notifications";
import type { WorkspaceData } from "@/lib/workspace";

export const queryKeys = {
  notifications: ["notifications"] as const,
  days: (month?: string) => (month ? (["days", month] as const) : (["days"] as const)),
  workspace: ["workspace"] as const,
};

export type NotificationFeed = { items: Notification[]; unread: number; lastSeen: string | null };

export const isUnread = (item: Notification, lastSeen: string | null) => !lastSeen || item.at > lastSeen;

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => fetchJSON<NotificationFeed>("/api/notifications") });
}

// Marks everything read straight away and puts it back if the server says no.
export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await send("/api/notifications", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res));
    },
    onMutate: async () => {
      await client.cancelQueries({ queryKey: queryKeys.notifications });
      const before = client.getQueryData<NotificationFeed>(queryKeys.notifications);
      if (before) client.setQueryData<NotificationFeed>(queryKeys.notifications, { ...before, unread: 0, lastSeen: new Date().toISOString() });
      return { before };
    },
    onError: (_error, _vars, context) => {
      if (context?.before) client.setQueryData(queryKeys.notifications, context.before);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

// ---- office days ----
export function useDays(month?: string) {
  return useQuery({ queryKey: queryKeys.days(month ?? "current"), queryFn: () => fetchJSON<DaysView>(month ? `/api/days?month=${month}` : "/api/days") });
}

// The server refuses an office mark it can't verify; `code` says why so the screen can ask
// for a location or explain that the person is outside the office.
export class MarkDayError extends Error {
  constructor(message: string, public code?: string, public distanceM?: number) { super(message); }
}
export type MarkDayInput = { mode: "office" | "none"; date?: string; lat?: number; lng?: number; accuracyM?: number };

export function useMarkDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkDayInput) => {
      const res = await send("/api/days", { method: "POST", json: input });
      if (!res.ok) {
        const body = await res.clone().json().catch(() => null);
        throw new MarkDayError(await readError(res), body?.code, body?.distanceM);
      }
      return (await res.json()) as DaysView;
    },
    // Every screen that shows days (Home, Days, any month) refetches.
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.days() }),
  });
}

// Plans one future day in or out. The server answers with that month's view.
export function usePlanDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; planned: boolean }) => {
      const res = await send("/api/days/plan", { method: "PATCH", json: input });
      if (!res.ok) throw new Error(await readError(res));
      return (await res.json()) as DaysView;
    },
    onSuccess: (view) => {
      client.setQueryData(queryKeys.days(view.month), view);
      return client.invalidateQueries({ queryKey: queryKeys.days() });
    },
  });
}

export type ClosedDay = { date: string; reason: string; createdBy: string; createdAt: string };
export function useClosedDays() {
  return useQuery({ queryKey: ["closed-days"], queryFn: () => fetchJSON<ClosedDay[]>("/api/admin/closed-days") });
}
function useClosedDayWrite(method: "POST" | "DELETE") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; reason?: string }) => {
      const res = await send("/api/admin/closed-days", { method, json: input });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["closed-days"] }), client.invalidateQueries({ queryKey: queryKeys.days() })]),
  });
}
export const useAddClosedDay = () => useClosedDayWrite("POST");
export const useRemoveClosedDay = () => useClosedDayWrite("DELETE");

export function useSetOfficeDays() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (officeDays: number[]) => {
      const res = await send("/api/days", { method: "PATCH", json: { officeDays } });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.days() }),
  });
}

// Events, announcements and the steps board. Shared with the legacy screens' API until the
// Feed and Steps screens get their own.
export function useWorkspace() {
  return useQuery({ queryKey: queryKeys.workspace, queryFn: () => fetchJSON<WorkspaceData>("/api/workspace") });
}

// ---- leave (read-only here; requests are still made on the legacy leave form) ----
export type LeaveBalances = { signedIn: boolean; ledger?: { type: "cl" | "sl" | "el" | "fl"; entitled: number; used: number; pending: number; remaining: number }[]; source?: "zoho-snapshot" | "app-only"; asOf?: string | null };
export type MyLeaveRequest = { id: string; type: "leave" | "wfh"; leaveType: string | null; halfDay: boolean; days: number; startDate: string; endDate: string; status: "pending" | "approved" | "rejected" | "cancelled" };

export function useLeaveBalances() {
  return useQuery({ queryKey: ["leave"], queryFn: () => fetchJSON<LeaveBalances>("/api/leave") });
}
export function useMyLeaveRequests() {
  return useQuery({ queryKey: ["away", "mine"], queryFn: () => fetchJSON<MyLeaveRequest[]>("/api/away?scope=mine") });
}

// ---- generic write: POST/PATCH/DELETE a JSON body, then refresh (or replace) the query ----
export function useSend<TInput = unknown, TOut = unknown>(key: readonly unknown[], url: string, method: "POST" | "PATCH" | "DELETE", opts: { replace?: boolean; also?: (readonly unknown[])[] } = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => {
      const res = await send(url, { method, json: input });
      if (!res.ok) throw new Error(await readError(res));
      return (await res.json().catch(() => null)) as TOut;
    },
    onSuccess: (data) => {
      if (opts.replace && data) client.setQueryData(key, data);
      else client.invalidateQueries({ queryKey: key });
      for (const k of opts.also ?? []) client.invalidateQueries({ queryKey: k });
    },
  });
}

export type { Feed, FeedPost } from "@/lib/feed";
export const useFeed = (options: { refetchOnMount?: boolean | "always" } = {}) => useQuery({ queryKey: ["feed"], queryFn: () => fetchJSON<import("@/lib/feed").Feed>("/api/feed"), ...options });

type FeedData = import("@/lib/feed").Feed;
function useFeedWrite<T>(url: string, method: "POST" | "PATCH" | "DELETE") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const res = await send(url, { method, json: input });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["feed"] }),
  });
}
export const usePostNotice = () => useFeedWrite<Record<string, unknown>>("/api/notices", "POST");
export const useReact = () => useFeedWrite<{ id: string; emoji: string }>("/api/notices", "PATCH");
export const useVote = () => useFeedWrite<{ id: string; vote: number | null }>("/api/notices", "PATCH");
export const useRsvp = () => useFeedWrite<{ eventId: string; going: boolean }>("/api/events", "PATCH");
export const useRemoveNotice = () => useFeedWrite<{ id: string }>("/api/notices", "DELETE");

// Seeing a card moves the watermark forward. The cache is patched in place (no refetch per card),
// so the stack the person is reading doesn't reshuffle under them.
export function useMarkFeedSeen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (at: string) => {
      const res = await send("/api/feed/seen", { method: "POST", json: { at } });
      if (!res.ok) throw new Error(await readError(res));
      return ((await res.json()) as { seenAt: string }).seenAt;
    },
    // Posts at or before the new watermark stop being new, so the badge and the next visit agree.
    onSuccess: (seenAt) => client.setQueryData<FeedData>(["feed"], (feed) => {
      if (!feed || seenAt <= feed.seenAt) return feed;
      const at = new Map(feed.posts.map((p) => [p.id, p.at]));
      return { ...feed, seenAt, newIds: feed.newIds.filter((id) => (at.get(id) ?? "") > seenAt) };
    }),
  });
}

export type ImportantAnnouncement = { id: string; title: string; body: string; authorName: string | null };
export const useImportantAnnouncement = () =>
  useQuery({ queryKey: ["announcements", "important"], queryFn: () => fetchJSON<{ announcement: ImportantAnnouncement | null }>("/api/announcements/important") });
export function useAckAnnouncement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await send("/api/announcements/ack", { method: "POST", json: { id } });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["announcements", "important"] }), client.invalidateQueries({ queryKey: ["feed"] })]),
  });
}

// The tea round that matters now (null once the day's rounds are done) and your answer for it:
// true = yes, false = skipping, null = not answered. counts/names come only to admins.
export type Tea = {
  date: string;
  round: { id: "am" | "pm"; at: string; closesAt: string; open: boolean; next: "am" | "pm" | null } | null;
  mine: boolean | null;
  times: { am: string; pm: string };
  counts?: { am: number; pm: number };
  names?: { am: string[]; pm: string[] };
};
// Refreshed every minute, so a round's cut-off shows on screen without a tap.
export const useTea = () => useQuery({ queryKey: ["tea"], queryFn: () => fetchJSON<Tea>("/api/tea"), refetchInterval: 60_000 });
export class TeaError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}
export function useAnswerTea() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { round: "am" | "pm"; going: boolean | null }) => {
      const res = await send("/api/tea", { method: "POST", json: input });
      if (!res.ok) {
        const body = await res.clone().json().catch(() => null);
        throw new TeaError(await readError(res), body?.code);
      }
      return (await res.json()) as Tea;
    },
    onSuccess: (tea) => client.setQueryData(["tea"], tea),
    onError: () => client.invalidateQueries({ queryKey: ["tea"] }),
  });
}

export type SnackRow = { id: string; name: string; note: string; orderedAt: string | null; votes: number; mine: boolean };
export type Snacks = {
  shelf: SnackRow[];
  suggestions: SnackRow[];
  canManage: boolean;
  // picks (counts per item) only come to admins.
  today: { open: boolean; orderAt: string; ordered: boolean; picks?: { itemId: string; count: number }[]; mine: string | null };
};
export function useSnackWrite<T>(method: "POST" | "PATCH") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const res = await send("/api/snacks", { method, json: input });
      if (!res.ok) throw new Error(await readError(res));
      return (await res.json()) as Snacks;
    },
    onSuccess: (snacks) => client.setQueryData(["snacks"], snacks),
    onError: () => client.invalidateQueries({ queryKey: ["snacks"] }),
  });
}
export type SnackTimes = { amAt: string; amClose: string; pmAt: string; pmClose: string; orderAt: string };
export const useSnackTimes = () => useQuery({ queryKey: ["snack-times"], queryFn: () => fetchJSON<SnackTimes>("/api/admin/snack-times") });
export function useSetSnackTimes() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (times: SnackTimes) => {
      const res = await send("/api/admin/snack-times", { method: "PATCH", json: times });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => Promise.all(["snack-times", "tea", "snacks"].map((k) => client.invalidateQueries({ queryKey: [k] }))),
  });
}
export const useSnacks = () => useQuery({ queryKey: ["snacks"], queryFn: () => fetchJSON<Snacks>("/api/snacks") });

export type Reading = {
  current: { bookId: string; title: string; author: string; page: number; pages: number; pct: number } | null;
  shelf: { id: string; title: string; author: string; read: number; want: number; mine: "want" | "reading" | "done" | null }[];
  finishedThisYear: number;
};
export const useReading = () => useQuery({ queryKey: ["reading"], queryFn: () => fetchJSON<Reading>("/api/reading") });

export type Account = { email: string; name: string; role: "admin" | "member"; birthday: string | null; showBirthday: boolean; officeDays: number[]; sayHi: boolean };
export const useAccount = () => useQuery({ queryKey: ["account"], queryFn: () => fetchJSON<Account>("/api/account") });

export type Steps = Awaited<ReturnType<typeof import("@/lib/today").stepsBoard>>;
export const useSteps = () => useQuery({ queryKey: ["steps"], queryFn: () => fetchJSON<Steps>("/api/steps") });

export type WifiReport = { id: string; quality: "good" | "poor"; note: string; downMbps: number | null; upMbps?: number | null; createdAt: string };
export const useWifiReports = () => useQuery({ queryKey: ["wifi"], queryFn: () => fetchJSON<WifiReport[]>("/api/wifi") });

export type FeedEvent = { id: string; title: string; body: string; category: string; startsAt: string; location: string; cancelledAt?: string; going: number; mine: boolean; canManage: boolean };
export const useEvent = (id: string) => useQuery({ queryKey: ["event", id], queryFn: () => fetchJSON<FeedEvent[]>(`/api/events?event=${encodeURIComponent(id)}`) });

// ---- admin ----
export type { AdminOverview, PersonMonth, PersonRow } from "@/lib/admin-view";
export type AdminData = import("@/lib/admin-view").AdminOverview & { needsYou: import("@/lib/admin-queue").NeedsYou[] };
export const useAdminOverview = () => useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchJSON<AdminData>("/api/admin/overview") });
export const useAdminPerson = (email: string | null, month: string) =>
  useQuery({ queryKey: ["admin", "person", email, month], enabled: !!email, queryFn: () => fetchJSON<import("@/lib/admin-view").PersonMonth>(`/api/admin/person?email=${encodeURIComponent(email ?? "")}&month=${month}`) });
export type Grievance = { id: string; body: string; displayName: string | null; image: string | null; urgent: boolean; status: "open" | "in_progress" | "resolved"; createdAt: string };
export const useAllGrievances = () => useQuery({ queryKey: ["admin", "grievances"], queryFn: () => fetchJSON<Grievance[]>("/api/grievances") });
