"use client";

import { useState } from "react";
import { CalendarDays, Megaphone } from "lucide-react";
import { Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// One composer for both things an admin posts. Announcements and events stay separate models —
// an event has a start time and RSVPs, an announcement has neither — but the forms sat in two
// near-identical cards, so only the toggle is new. Each form is still a plain POST that works
// without JavaScript once rendered.
export default function PostComposer() {
  const [kind, setKind] = useState<"announcement" | "event">("announcement");

  return (
    <>
      <div className="mt-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "announcement", label: "Announcement" },
            { value: "event", label: "Event" },
          ]}
        />
      </div>

      {kind === "announcement" ? (
        <form action="/api/announcements" method="post" className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Input name="title" required maxLength={120} placeholder="Title — e.g. Team Lunch on Friday" aria-label="Title" />
          <Input name="tag" maxLength={30} placeholder="Tag (Office)" aria-label="Tag" />
          <Textarea name="body" maxLength={500} placeholder="Details (optional)" aria-label="Details" className="resize-none sm:col-span-2" />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Appears on everyone&apos;s home dashboard and notifies anyone with notifications on.
          </p>
          <Button type="submit" size="xl" className="sm:col-span-2">
            <Megaphone /> Post announcement
          </Button>
        </form>
      ) : (
        <form action="/api/events" method="post" className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input name="title" required maxLength={80} placeholder="Title — e.g. IPL screening in the common area" aria-label="Event title" className="sm:col-span-2" />
          <select
            name="category"
            aria-label="Category"
            defaultValue="company"
            className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="sports">Sports</option>
            <option value="arts">Arts</option>
            <option value="culture">Culture</option>
            <option value="learning">Learning</option>
            <option value="social">Social</option>
            <option value="company">Company</option>
          </select>
          <Input name="startsAt" type="datetime-local" required aria-label="Starts at" />
          <Input name="location" maxLength={60} placeholder="Location (optional)" aria-label="Location" />
          <Textarea name="body" maxLength={500} placeholder="Details (optional)" aria-label="Details" className="resize-none" />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Appears on the Events page and on home, with one-tap RSVP.
          </p>
          <Button type="submit" size="xl" className="sm:col-span-2">
            <CalendarDays /> Publish event
          </Button>
        </form>
      )}
    </>
  );
}
