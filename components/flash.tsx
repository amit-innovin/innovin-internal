"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const MESSAGES: Record<string, { type: "success" | "error"; text: string }> = {
  posted: { type: "success", text: "Announcement posted to everyone's home dashboard" },
  deleted: { type: "success", text: "Announcement deleted" },
  "missing-title": { type: "error", text: "Add a title to post an announcement" },
  "event-posted": { type: "success", text: "Event published" },
  "event-deleted": { type: "success", text: "Event deleted" },
  "invalid-event": { type: "error", text: "Check the event's category and start time" },
};

// Turns a `?done=` flash key (set by a form redirect) into a toast, then cleans the URL.
export function Flash({ done }: { done?: string }) {
  useEffect(() => {
    const message = done ? MESSAGES[done] : undefined;
    if (!message) return;
    toast[message.type](message.text, { id: `flash-${done}` });
    // Drop only the flash keys — other params (e.g. the dashboard's ?tab=) must survive, or a
    // later reload or router.refresh() would land on a different section.
    const url = new URL(window.location.href);
    url.searchParams.delete("done");
    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [done]);
  return null;
}
