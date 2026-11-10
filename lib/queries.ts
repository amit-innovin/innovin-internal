"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJSON, readError, send } from "@/lib/fetcher";
import type { Notification } from "@/lib/notifications";

export const queryKeys = { notifications: ["notifications"] as const };

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
