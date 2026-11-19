import type { Metadata } from "next";
import { AppShell } from "@/components/m3/app-shell";
import { SpeakUpPage } from "@/components/speak-up/speak-up-page";
import { currentActor } from "@/lib/admin";
import { shellProps } from "@/lib/admin-queue";

export const metadata: Metadata = { title: "Speak up · Innovin" };

// Public on purpose: Speak up works signed out, so anonymity never depends on a session.
// Signed-in people get it inside the app shell; everyone else gets the page on its own.
export default async function Page() {
  const actor = await currentActor();
  if (!actor) return <div className="m3-app"><main className="m3-main" style={{ paddingBottom: 32 }}><SpeakUpPage name={null} /></main></div>;
  return <AppShell {...await shellProps(actor)}><SpeakUpPage name={actor.name || actor.email} /></AppShell>;
}
