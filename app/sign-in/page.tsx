import { redirect } from "next/navigation";
import { SignInCard } from "@/components/auth/sign-in-card";
import { currentActor } from "@/lib/admin";
import { sanitizeNext } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

const AUTH_ERRORS: Record<string, string> = {
  failed: "That didn’t work. Use your @innovinlabs.com Google account.",
  busy: "Too many tries. Wait a minute and try again.",
};

// The one page a signed-out visitor sees (besides anonymous Speak Up). The proxy sends every
// other page here with ?next=, and Google sign-in failures land here with ?auth=.
export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; auth?: string }> }) {
  const params = await searchParams;
  const requested = sanitizeNext(params.next ?? "/");
  const next = requested.startsWith("/sign-in") ? "/" : requested;
  if (await currentActor()) redirect(next);
  // "unavailable" needs no error: without Google configured the card says sign-in isn't set up.
  return <SignInCard googleEnabled={googleConfigured()} next={next} error={params.auth ? AUTH_ERRORS[params.auth] : undefined} />;
}
