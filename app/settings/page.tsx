"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Info, Lock, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { IconTile, PageHeader } from "@/components/kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { firstName, initials } from "@/lib/format";

export default function Settings() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  const load = async () => {
    const data = await getJSON<{ email: string | null }>("/api/attendance", "your profile");
    if (data) setEmail(data.email);
  };
  useEffect(() => {
    load();
  }, []);

  async function forget() {
    const res = await send("/api/attendance", { method: "DELETE" });
    if (!res.ok) return toast.error(await readError(res));
    toast.success("This device no longer remembers your email.");
    await load();
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Settings" />

      {email === undefined ? (
        <Card className="flex-row items-center gap-4 p-6">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-44" />
          </div>
        </Card>
      ) : (
        <Card className="gap-0 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-accent text-lg font-medium text-accent-foreground">
                {email ? initials(email) : <User className="size-6" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">{firstName(email) ?? "Guest"}</p>
              <p className="truncate text-sm text-muted-foreground">{email ?? "No email saved on this device"}</p>
            </div>
          </div>
          {email ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="xl" className="mt-6 w-full">
                  <LogOut /> Forget me on this device
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Forget your email?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You&apos;ll need to enter your Innovin email again next time you check in on this device. Your
                    attendance history isn&apos;t affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={forget}>Forget me</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Check in once from{" "}
              <Link href="/attendance" className="font-medium text-accent-foreground hover:underline">
                Attendance
              </Link>{" "}
              and we&apos;ll remember your email here.
            </p>
          )}
        </Card>
      )}

      <Link href="/admin" className="group mt-4 block">
        <Card className="flex-row items-center gap-4 p-5 transition-[box-shadow,border-color] duration-200 ease-brand group-hover:border-brand-sky/60 group-hover:shadow-lift">
          <IconTile icon={Lock} tone="slate" />
          <div className="flex-1">
            <p className="text-sm font-medium">Admin dashboard</p>
            <p className="text-xs text-muted-foreground">For office coordinators — passcode required.</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Card>
      </Link>

      <p className="mt-6 flex gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Anonymous grievances are never linked to your name or email.
      </p>
    </div>
  );
}
