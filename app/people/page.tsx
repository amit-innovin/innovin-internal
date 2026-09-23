"use client";

import { useEffect, useState } from "react";
import { UserRound, Users } from "lucide-react";
import { Empty, IconTile, PageHeader, stagger } from "@/components/kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON } from "@/lib/fetcher";
import { fmtTime } from "@/lib/format";

type Person = { name: string; email: string; picture: string; role: "owner" | "admin" | "member"; since: string };
type Present = { name: string; since: string; where: string };
type Directory = { people: Person[]; inToday: Present[] };

const WHERE_LABEL: Record<string, string> = { office: "In office", remote: "Remote", unknown: "Location not shared" };

const nameInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function PersonAvatar({ name, picture }: { name: string; picture?: string }) {
  return (
    <Avatar className="size-9">
      {picture && <AvatarImage src={picture} alt="" />}
      <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
        {nameInitials(name) || <UserRound className="size-4" />}
      </AvatarFallback>
    </Avatar>
  );
}

export default function People() {
  const [data, setData] = useState<Directory | null>(null);

  useEffect(() => {
    getJSON<Directory>("/api/people", "the directory").then((d) => d && setData(d));
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="People" subtitle="Everyone at Innovin — and who's in today" />

      {!data ? (
        <div className="space-y-3">
          <Card className="gap-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </Card>
          <Card className="gap-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </Card>
        </div>
      ) : (
        <>
          <Card className="gap-0 p-5">
            <h2 className="eyebrow">
              In today{data.inToday.length > 0 ? ` · ${data.inToday.length}` : ""}
            </h2>
            {data.inToday.length === 0 ? (
              <Empty>No one has checked in yet today.</Empty>
            ) : (
              <ul className="mt-1 divide-y">
                {data.inToday.map((p, i) => (
                  <li key={p.name + p.since} className="flex items-center gap-3 py-3" style={stagger(i)}>
                    <PersonAvatar name={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">since {fmtTime(p.since)}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {WHERE_LABEL[p.where] ?? "Location not shared"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-4 gap-0 p-5">
            <h2 className="eyebrow">Everyone{data.people.length > 0 ? ` · ${data.people.length}` : ""}</h2>
            {data.people.length === 0 ? (
              <div className="py-6 text-center">
                <IconTile icon={Users} tone="slate" className="mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">
                  The directory fills up as people sign in with their Innovin Google account.
                </p>
              </div>
            ) : (
              <ul className="mt-1 divide-y">
                {data.people.map((p, i) => (
                  <li key={p.email} className="flex items-center gap-3 py-3" style={stagger(i)}>
                    <PersonAvatar name={p.name} picture={p.picture} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    </div>
                    {p.role !== "member" && (
                      <Badge variant="secondary" className="shrink-0 capitalize">
                        {p.role}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
