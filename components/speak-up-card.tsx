"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { readError, send } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

// The fast path for "something's wrong" — anonymous, optional urgent flag, straight from home.
// Photos, naming yourself and your submission history stay on /grievances.
export default function SpeakUpCard() {
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const res = await send("/api/grievances", { method: "POST", json: { body, urgent } });
    setBusy(false);
    if (!res.ok) return toast.error(await readError(res));
    setBody("");
    setUrgent(false);
    toast.success(urgent ? "Sent — admins get pinged right away." : "Heard. Thank you.");
  };

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Speak Up</h2>
        <span className="text-xs text-muted-foreground">Anonymous by default</span>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={500}
        placeholder="Anything bugging you? Broken AC, food, Wi-Fi, whatever…"
        aria-label="Speak up anonymously"
        className="mt-3 min-h-20 resize-none rounded-lg text-sm"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          aria-pressed={urgent}
          onClick={() => setUrgent((u) => !u)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            urgent
              ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              : "text-muted-foreground hover:bg-muted/60",
          )}
        >
          <TriangleAlert className="size-3.5" />
          Urgent
        </button>
        <div className="flex-1" />
        <Button size="sm" onClick={submit} disabled={!body.trim() || busy}>
          <Send className="size-3.5" /> {busy ? "Sending…" : "Send"}
        </Button>
      </div>
      <Link href="/grievances" className="mt-3 block text-center text-xs font-medium text-accent-foreground hover:underline">
        Photo, name & your history →
      </Link>
    </Card>
  );
}
