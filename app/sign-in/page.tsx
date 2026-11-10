import { redirect } from "next/navigation";
import { WorkspaceOnboarding } from "@/components/workspace/onboarding";
import { currentActor } from "@/lib/admin";
import { sanitizeNext } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

const AUTH_ERRORS: Record<string, string> = {
  failed: "Sign-in didn't complete. Use your Innovin Google account.",
  unavailable: "Sign-in isn't configured on this deployment.",
  busy: "Too many sign-in attempts — try again shortly.",
};

// The one page a signed-out visitor sees (besides anonymous Speak Up). The proxy sends every
// other page here with ?next=, and Google sign-in failures land here with ?auth=.
export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; auth?: string }> }) {
  const params = await searchParams;
  const requested = sanitizeNext(params.next ?? "/");
  const next = requested.startsWith("/sign-in") ? "/" : requested;
  if (await currentActor()) redirect(next);
  return <WorkspaceOnboarding googleEnabled={googleConfigured()} next={next} error={params.auth ? AUTH_ERRORS[params.auth] : undefined} />;
}
