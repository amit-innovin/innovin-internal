"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getJSON, readError, send } from "@/lib/fetcher";
import { fmtTime } from "@/lib/format";
import { PING_MAX_LEN, PING_PRESETS } from "@/lib/pings";
import { StudioDialog } from "@/components/workspace/dialog";
import { cn } from "@/lib/utils";

export type PingTarget = { email: string; name: string; picture?: string };
type Message = { id: string; body: string; at: string; mine: boolean };
type Thread = { person: PingTarget; messages: Message[] };

// A one-line conversation with one person. Messages vanish after 24h — this is a nudge,
// not a chat archive, so there's deliberately nothing to scroll back through.
export function PingSheet({ target, onClose }: { target: PingTarget; onClose: () => void }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const data = await getJSON<Thread>(`/api/pings?with=${encodeURIComponent(target.email)}`, "the conversation", {
      fresh: true,
    });
    if (data) {
      setThread(data);
      // Opening the thread acknowledges it — clears unread on the inbox and the bell.
      send("/api/pings", { method: "PATCH", json: { from: target.email } }).catch(() => {});
    }
  }, [target.email]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // light polling while open — new pings just appear
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [load, onClose]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function sendPing(body: string) {
    const clean = body.trim();
    if (!clean || sending) return;
    setSending(true);
    const res = await send("/api/pings", { method: "POST", json: { to: target.email, body: clean } });
    setSending(false);
    if (!res.ok) return toast.error(await readError(res));
    setText("");
    load();
  }

  return (
    <StudioDialog title={`Ping ${target.name}`} description="Private messages disappear after 24 hours." onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border bg-card shadow-lift sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Avatar className="size-8">
            {target.picture && <AvatarImage src={target.picture} alt="" />}
            <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
              {target.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{target.name}</p>
            <p className="text-[11px] text-muted-foreground">Pings vanish after 24 hours — say it, don't store it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-accent/50">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-32 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {!thread ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : thread.messages.length === 0 ? (
            <div className="py-6 text-center">
              <MessageCircle className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Nothing yet — tap a nudge below to say hi.</p>
            </div>
          ) : (
            thread.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-1.5 text-sm",
                    m.mine ? "bg-accent text-accent-foreground" : "bg-accent/40",
                  )}
                >
                  <p className="break-words">{m.body}</p>
                  <p className="mt-0.5 text-right text-[10px] opacity-60">{fmtTime(m.at)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>

        <div className="border-t px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PING_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={sending}
                onClick={() => sendPing(preset)}
                className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-accent/50 disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendPing(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={PING_MAX_LEN}
              placeholder={`Ping ${target.name.split(" ")[0]}…`}
              aria-label="Ping message"
              className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
            <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Send ping">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </StudioDialog>
  );
}
