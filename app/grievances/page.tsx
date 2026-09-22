"use client";

import { useEffect, useState } from "react";
import { Info, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { VoiceArt } from "@/components/art";
import { IconTile, PageHeader, STATUS_META, Segmented, StatusPill, stagger } from "@/components/kit";
import { StatefulButton } from "@/components/motion/button/stateful";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getJSON, readError, send } from "@/lib/fetcher";
import { useButtonState } from "@/lib/hooks/use-button-state";
import { relativeTime } from "@/lib/format";
import type { GrievanceStatus } from "@/lib/types";

const MAX = 500;

type Mine = { id: string; body: string; displayName: string | null; status: GrievanceStatus; createdAt: string };

export default function Grievances() {
  const [mode, setMode] = useState<"anonymous" | "named">("anonymous");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);
  const [buttonState, run] = useButtonState();

  const load = async () => {
    const data = await getJSON<Mine[]>("/api/grievances?scope=mine", "your submissions");
    if (data) setMine(data);
    return data;
  };
  useEffect(() => {
    // Home's "View all" deep-links to #mine — scroll there once the list has rendered.
    load().then((data) => {
      if (data?.length && window.location.hash === "#mine") {
        requestAnimationFrame(() => document.getElementById("mine")?.scrollIntoView({ behavior: "smooth" }));
      }
    });
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await send("/api/grievances", {
        method: "POST",
        json: { body, displayName: mode === "anonymous" ? null : name },
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return false;
      }
      setBody("");
      toast.success("Thank you — we'll look into it and take action where needed.");
      await load();
      return true;
    });
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Daily Grievances" />

      <form onSubmit={submit}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "anonymous", label: "Anonymous" },
            { value: "named", label: "With Name" },
          ]}
        />

        {mode === "named" && (
          <Input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            className="mt-4 animate-in fade-in slide-in-from-top-1 duration-300"
          />
        )}

        <Textarea
          value={body}
          required
          maxLength={MAX}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your feedback..."
          aria-label="Your feedback"
          className="mt-4 min-h-32 resize-none rounded-lg"
        />
        <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
          {body.length}/{MAX}
        </div>

        <StatefulButton
          type="submit"
          state={buttonState}
          disabled={!body.trim()}
          loadingText="Submitting"
          successText="Submitted"
          errorText="Try again"
          icon={<Send className="size-4" />}
          className="mt-4 h-11 w-full rounded-lg font-medium"
        >
          Submit
        </StatefulButton>
      </form>

      <div className="t-stagger mt-8 text-center">
        <div style={stagger(0)}>
          <VoiceArt />
        </div>
        <p className="mt-3 text-sm text-muted-foreground" style={stagger(1)}>
          Your voice helps us
          <br />
          make things better.
        </p>
        <p className="mx-auto mt-3 flex max-w-sm justify-center gap-1.5 text-xs text-muted-foreground/80" style={stagger(2)}>
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Anonymous means anonymous — no one, including admins, can see who wrote it.
        </p>
      </div>

      {mine.length > 0 && (
        <Card id="mine" className="mt-8 gap-0 p-5">
          <h2 className="eyebrow">Your submissions</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">Only visible on this device.</p>
          <ul className="t-stagger mt-2 divide-y">
            {mine.map((g, i) => (
              <li key={g.id} className="flex items-start gap-3 py-3" style={stagger(i)}>
                <IconTile icon={MessageSquare} tone={STATUS_META[g.status].tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{g.body}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relativeTime(g.createdAt)} • {g.displayName ? "With name" : "Anonymous"}
                  </p>
                </div>
                <StatusPill status={g.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
