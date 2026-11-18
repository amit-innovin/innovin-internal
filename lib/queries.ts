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
  today: { open: boolean; orderAt: string; ordered: boolean; orderedAt?: string | null; picks?: { itemId: string; count: number }[]; mine: string | null };
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

export type WifiReport = { id: string; quality: "good" | "poor"; note: string; downMbps: number | null; upMbps?: number | null; createdAt: string; area?: string | null };
export const useWifiReports = () => useQuery({ queryKey: ["wifi"], queryFn: () => fetchJSON<WifiReport[]>("/api/wifi") });

export type FeedEvent = { id: string; title: string; body: string; category: string; startsAt: string; location: string; cancelledAt?: string; going?: number; mine: boolean; canManage: boolean; inCalendar?: boolean };
export const useEvent = (id: string) => useQuery({ queryKey: ["event", id], queryFn: () => fetchJSON<FeedEvent[]>(`/api/events?event=${encodeURIComponent(id)}`) });

// ---- admin ----
export type { AdminOverview, PersonMonth, PersonRow } from "@/lib/admin-view";
export type AdminData = import("@/lib/admin-view").AdminOverview & { needsYou: import("@/lib/admin-queue").NeedsYou[] };
export const useAdminOverview = () => useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchJSON<AdminData>("/api/admin/overview") });
export type TeamMonth = { month: string; today: string; days: { date: string; closed: boolean; future: boolean }[]; people: { email: string; name: string; role: "admin" | "member"; exempt: boolean; left: boolean; marks: Record<string, "office" | "leave"> }[] };
export const useTeamMonth = (month: string) => useQuery({ queryKey: ["admin", "team", month], queryFn: () => fetchJSON<TeamMonth>(`/api/admin/team?month=${month}`) });
export const useAdminPerson = (email: string | null, month: string) =>
  useQuery({ queryKey: ["admin", "person", email, month], enabled: !!email, queryFn: () => fetchJSON<import("@/lib/admin-view").PersonMonth>(`/api/admin/person?email=${encodeURIComponent(email ?? "")}&month=${month}`) });
export type Grievance = { id: string; body: string; displayName: string | null; image: string | null; urgent: boolean; status: "open" | "in_progress" | "resolved"; createdAt: string; topic?: string | null; reply?: string | null };
export const useAllGrievances = () => useQuery({ queryKey: ["admin", "grievances"], queryFn: () => fetchJSON<Grievance[]>("/api/grievances") });

// Admin app writes (components/admin-app). Each refreshes what it changed, plus the admin
// overview, whose "Needs you" list depends on most of them.
function useAdminWrite<T>(url: string, method: "POST" | "PATCH" | "DELETE", keys: (readonly unknown[])[]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const res = await send(url, { method, json: input });
      if (!res.ok) throw new Error(await readError(res));
      return (await res.json().catch(() => null)) as unknown;
    },
    onSuccess: () => Promise.all([...keys, ["admin", "overview"]].map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}
export const useSetGrievance = () => useAdminWrite<{ id: string; status?: Grievance["status"]; reply?: string | null }>("/api/grievances", "PATCH", [["admin", "grievances"]]);
// One person: exempt from the 8 days, admin or member, or their birthday ("MM-DD" or null).
export const useSetPerson = () => useAdminWrite<{ email: string; left?: boolean; officeExempt?: boolean; role?: "admin" | "member"; birthday?: string | null; showBirthday?: boolean }>("/api/people", "PATCH", [["admin"]]);
export const useFixDay = () => useAdminWrite<{ email: string; date: string; mode: "office" | "none" }>("/api/admin/days", "POST", [["admin"], queryKeys.days()]);

export type ReportedPost = { id: string; kind: string; title: string; body: string; authorName: string | null; createdAt: string; reports: number };
export const useReported = () => useQuery({ queryKey: ["admin", "reported"], queryFn: () => fetchJSON<ReportedPost[]>("/api/admin/reported") });
export const useKeepPost = () => useAdminWrite<{ id: string }>("/api/admin/reported", "DELETE", [["admin", "reported"]]);
export const useRemovePost = () => useAdminWrite<{ id: string }>("/api/notices", "DELETE", [["admin", "reported"], ["feed"]]);

export type AdminAnnouncement = { id: string; title: string; body: string; createdAt: string; pinnedUntil?: string | null; seen?: number };
export const useAnnouncements = () => useQuery({ queryKey: ["admin", "announcements"], queryFn: () => fetchJSON<AdminAnnouncement[]>("/api/announcements") });
export const usePublishAnnouncement = () => useAdminWrite<{ title: string; body: string; pinnedUntil?: string }>("/api/announcements", "POST", [["admin", "announcements"], ["feed"]]);
export const useDeleteAnnouncement = () => useAdminWrite<{ action: "delete"; id: string }>("/api/announcements", "POST", [["admin", "announcements"], ["feed"]]);

export type AdminEvent = FeedEvent & { updatedAt?: string; createdAt: string; invite?: "sent" | "failed" | "stale" | "orphaned" | null };
export const useEvents = () => useQuery({ queryKey: ["events"], queryFn: () => fetchJSON<AdminEvent[]>("/api/events") });
export const usePostEvent = () => useAdminWrite<{ title: string; category: string; startsAt: string; body: string; location: string; invite?: boolean }>("/api/events", "POST", [["events"], ["feed"]]);
// The signed-in admin's Google Calendar connection, and what disconnecting would do to their invites.
export type CalendarStatus = { configured: boolean; me: string; connected: { email: string; since: string } | null; upcoming?: number; successor?: string | null; successorName?: string | null };
export const useCalendar = () => useQuery({ queryKey: ["admin", "calendar"], queryFn: () => fetchJSON<CalendarStatus>("/api/admin/calendar") });
export const useDisconnectCalendar = () => useAdminWrite<Record<string, never>>("/api/admin/calendar", "POST", [["admin", "calendar"], ["events"]]);
export const useResendInvite = () => useAdminWrite<{ id: string }>("/api/admin/calendar/invite", "POST", [["events"]]);
// Edit an event's details (admins). Guests who said they're going, and the Google invite, follow.
export const useEditEvent = () => useAdminWrite<{ action: "update"; id: string; expectedUpdatedAt: string; title: string; category: string; startsAt: string; body: string; location: string }>("/api/events", "PATCH", [["events"], ["feed"]]);
export const useCancelEvent = () => useAdminWrite<{ id: string; expectedUpdatedAt: string }>("/api/events", "DELETE", [["events"], ["feed"]]);
export const useDeleteEvent = () => useAdminWrite<{ action: "delete"; id: string }>("/api/events", "POST", [["events"], ["feed"]]);
