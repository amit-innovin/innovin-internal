import { redirect } from "next/navigation";
import { HomePage } from "@/components/home/home-page";
import { requireUser } from "@/lib/admin";
import { workspacePath } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";

// Today. Links from the earlier Home workspace (/?view=days, /?view=event&event=…) go to the
// real page, so bookmarks, notifications and the Calendar connect return keep working.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireUser();
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : null;
  if (view) {
    const rest = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (key !== "view" && key !== "event" && typeof value === "string") rest.set(key, value);
    const event = typeof params.event === "string" ? params.event : null;
    const base = view === "event" && event ? `/feed/events/${encodeURIComponent(event)}` : view.startsWith("admin-") && actor.role !== "admin" ? "/" : workspacePath(view);
    redirect(`${base}${rest.size ? `?${rest}` : ""}`);
  }
  const name = actor.name || actor.email.split("@")[0];
  return <HomePage name={name} firstName={name.split(/\s+/)[0]} isAdmin={actor.role === "admin"} />;
}
