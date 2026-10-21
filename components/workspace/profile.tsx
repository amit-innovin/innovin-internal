"use client";
import { useState } from "react";
import { toast } from "sonner";
import { send, readError } from "@/lib/fetcher";
import type { WorkspaceProfile } from "@/lib/types";
import { StudioDialog } from "./dialog";

export function ProfileEditor({ profile, onClose, onSaved }: { profile: WorkspaceProfile | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <StudioDialog title="Make this space yours" description="Let your teammates know where to find you and what you're working on." onClose={onClose}>
    <form className="studio-form" onSubmit={async (e) => {
      e.preventDefault(); if (busy) return;
      const json = Object.fromEntries(new FormData(e.currentTarget));
      setBusy(true);
      const res = await send("/api/workspace", { method: "PATCH", json });
      if (!res.ok) { setBusy(false); return toast.error(await readError(res)); }
      await onSaved(); onClose(); toast.success("Profile updated");
    }}>
      {([["designation", "Job title"], ["department", "Department"], ["project", "Project"], ["floor", "Floor"], ["desk", "Desk"], ["focus", "Current focus"]] as const).map(([key, label]) => <label key={key}>{label}<input name={key} maxLength={120} defaultValue={profile?.[key] ?? ""} placeholder={label === "Project" ? "What are you building?" : label} /></label>)}
      <button className="studio-button mt-2" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  </StudioDialog>;
}
