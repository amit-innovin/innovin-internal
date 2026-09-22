"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const MESSAGES: Record<string, { type: "success" | "error"; text: string }> = {
  posted: { type: "success", text: "Announcement posted to everyone's home dashboard" },
  deleted: { type: "success", text: "Announcement deleted" },
  "missing-title": { type: "error", text: "Add a title to post an announcement" },
};

// Turns a `?done=` flash key (set by a form redirect) into a toast, then cleans the URL.
export function Flash({ done }: { done?: string }) {
  useEffect(() => {
    const message = done ? MESSAGES[done] : undefined;
    if (!message) return;
    toast[message.type](message.text, { id: `flash-${done}` });
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, [done]);
  return null;
}
