"use client";
import { LoadRecovery } from "@/components/load-recovery";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, ChevronRight, Info, Lock, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { IconTile, PageHeader } from "@/components/kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { firstName, initials } from "@/lib/format";

type Auth = { signedIn: boolean; googleEnabled: boolean; email?: string; name?: string };

const AUTH_ERRORS: Record<string, string> = {
  failed: "Sign-in didn't complete. Use your Innovin Google account.",
  unavailable: "Sign-in isn't configured on this deployment.",
  busy: "Too many sign-in attempts — try again shortly.",
};

export default function Settings() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [auth, setAuth] = useState<Auth | null>(null);

  const load = async () => {
    const me = await getJSON<Auth>("/api/auth/me", "your sign-in");
    if (me) { setAuth(me); setEmail(me.email ?? null); }
  };
  useEffect(() => {
    load();
    const reason = new URLSearchParams(window.location.search).get("auth");
    if (reason && AUTH_ERRORS[reason]) toast.error(AUTH_ERRORS[reason]);
  }, []);

  async function signOut() {
    const res = await send("/api/auth/logout", { method: "POST" });
    if (!res.ok) return toast.error(await readError(res));
    toast.success("Signed out of this device.");
    window.location.assign("/");
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Settings" />

      {email === undefined || auth === null ? (<LoadRecovery>
        <Card className="flex-row items-center gap-4 p-6">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-44" />
          </div>
        </Card>
      </LoadRecovery>) : (
        <Card className="gap-0 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-accent text-lg font-medium text-accent-foreground">
                {auth.signedIn ? initials(auth.name || auth.email!) : email ? initials(email) : <User className="size-6" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">{auth.signedIn ? auth.name : (firstName(email) ?? "Guest")}</p>
              <p className="truncate text-sm text-muted-foreground">
                {auth.signedIn ? auth.email : (email ?? "No email saved on this device")}
              </p>
              {auth.signedIn && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <BadgeCheck className="size-3.5" /> Verified with Google
                </p>
              )}
            </div>
          </div>
          {auth.signedIn ? (
            <Button variant="outline" size="xl" className="mt-6 w-full" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          ) : auth.googleEnabled ? (
            <Button asChild variant="outline" size="xl" className="mt-6 w-full">
              <a href="/api/auth/google?next=/settings">
                <BadgeCheck /> Sign in with Google
              </a>
            </Button>
          ) : null}
        </Card>
      )}

      {!email && !auth?.signedIn && auth !== null && (
        <p className="mt-4 px-1 text-sm text-muted-foreground">
          Sign in with Google from{" "}
          <Link href="/attendance" className="font-medium text-accent-foreground hover:underline">
            Attendance
          </Link>{" "}
          to use employee tools.
        </p>
      )}

      <Link href="/admin" className="group mt-4 block">
        <Card className="flex-row items-center gap-4 p-5 transition-[box-shadow,border-color] duration-200 ease-brand group-hover:border-brand-sky/60 group-hover:shadow-lift">
          <IconTile icon={Lock} tone="slate" />
          <div className="flex-1">
            <p className="text-sm font-medium">Admin dashboard</p>
            <p className="text-xs text-muted-foreground">For office coordinators with admin access.</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Card>
      </Link>

      <p className="mt-6 flex gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Anonymous reports are never linked to your name or email.
      </p>
    </div>
  );
}
