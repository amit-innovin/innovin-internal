"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Info, MessageSquare, Send, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { VoiceArt } from "@/components/art";
import { ImagePreview } from "@/components/image-preview";
import { IconTile, PageHeader, STATUS_META, Segmented, StatusPill, stagger } from "@/components/kit";
import { StatefulButton } from "@/components/motion/button/stateful";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getJSON, readError, send } from "@/lib/fetcher";
import { useButtonState } from "@/lib/hooks/use-button-state";
import { relativeTime } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { GrievanceStatus } from "@/lib/types";

const MAX = 500;

type Mine = { id: string; body: string; displayName: string | null; image: string | null; urgent: boolean; status: GrievanceStatus; createdAt: string };

export default function Grievances() {
  const [mode, setMode] = useState<"anonymous" | "named">("anonymous");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [mine, setMine] = useState<Mine[]>([]);
  const [buttonState, run] = useButtonState();
  const fileInput = useRef<HTMLInputElement>(null);

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

  async function attach(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("That file isn't a photo");
    setCompressing(true);
    try {
      setImage(await compressImage(file));
    } catch {
      toast.error("Couldn't read that photo — try a different one");
    } finally {
      setCompressing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await send("/api/grievances", {
        method: "POST",
        json: { body, displayName: mode === "anonymous" ? null : name, image, urgent },
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return false;
      }
      setBody("");
      setImage(null);
      setUrgent(false);
      toast.success(urgent ? "Sent — admins get pinged right away." : "Thank you — we'll look into it.");
      await load();
      return true;
    });
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Speak Up" subtitle="Something broken, unfair, or bugging you? Say it here — anonymously if you like." />

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

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          aria-label="Attach a photo"
          className="hidden"
          onChange={(e) => attach(e.target.files?.[0])}
        />
        {image ? (
          <div className="relative mt-3 inline-block">
            <ImagePreview src={image} alt="Attached photo" className="size-20" />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="Remove photo"
              className="absolute -right-2 -top-2 rounded-full border bg-card p-1 text-muted-foreground shadow-sm hover:text-destructive"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={compressing}
            onClick={() => fileInput.current?.click()}
            className="mt-3 text-muted-foreground"
          >
            <ImagePlus /> {compressing ? "Preparing photo…" : "Add a photo (optional)"}
          </Button>
        )}
        {mode === "anonymous" && image && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Photos are part of the report — avoid faces or names if you want to stay anonymous.
          </p>
        )}

        <button
          type="button"
          aria-pressed={urgent}
          onClick={() => setUrgent((u) => !u)}
          className={cn(
            "mt-3 flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
            urgent ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" : "text-muted-foreground hover:bg-muted/60",
          )}
        >
          <TriangleAlert className="size-4 shrink-0" />
          <span className="flex-1 text-sm">
            <span className="font-medium">This is urgent</span>
            <span className="block text-xs opacity-80">Pings admins right away — still anonymous.</span>
          </span>
          <span className={cn("size-5 rounded-full border text-[10px] leading-5 text-center", urgent ? "border-rose-500 bg-rose-500 text-white" : "text-muted-foreground")}>
            {urgent ? "✓" : ""}
          </span>
        </button>

        <StatefulButton
          type="submit"
          state={buttonState}
          disabled={!body.trim() || compressing}
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
                  {g.image && <ImagePreview src={g.image} alt="Attached photo" className="mt-2" />}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relativeTime(g.createdAt)} • {g.displayName ? "With name" : "Anonymous"}
                    {g.urgent && <span className="font-medium text-rose-600"> • Urgent</span>}
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
