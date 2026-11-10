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
export type MarkDayInput = { mode: "office" | "remote" | "none"; date?: string; lat?: number; lng?: number; accuracyM?: number };

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
