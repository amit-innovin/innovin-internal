"use client";
import { LoadRecovery } from "@/components/load-recovery";

import { useEffect, useState } from "react";
import { MessageCircle, UserRound, Users } from "lucide-react";
import { Empty, IconTile, PageHeader, stagger } from "@/components/kit";
import { PingSheet, type PingTarget } from "@/components/ping-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON } from "@/lib/fetcher";
import { LOCATION_LABEL, type LocationTag } from "@/lib/geo";
import { fmtTime, relativeTime } from "@/lib/format";

type Person = { name: string; email: string; picture: string; role: "owner" | "admin" | "member"; since: string };
type Present = { name: string; email?: string; since: string; where: LocationTag };
type Directory = { people: Person[]; inToday: Present[] };
type Thread = { email: string; name: string; picture: string; unread: number; last: { body: string; at: string; mine: boolean } };
type Pings = { signedIn: boolean; me?: string; threads: Thread[] };

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
  const [pings, setPings] = useState<Pings | null>(null);
  const [query,setQuery]=useState("");
  const [target, setTarget] = useState<PingTarget | null>(null);

  const loadPings = () => getJSON<Pings>("/api/pings", "pings").then((d) => d && setPings(d));

  useEffect(() => {
    getJSON<Directory>("/api/people", "the directory").then((d) => d && setData(d));
    loadPings();
    // A ping notification deep-links here (?ping=email) — open that thread straight away.
    const pingParam = new URLSearchParams(window.location.search).get("ping");
    if (pingParam) setTarget({ email: pingParam, name: pingParam });
  }, []);

  const canPing = (email: string) => !!pings?.signedIn && email !== pings.me;

  const pingButton = (p: PingTarget) =>
    canPing(p.email) ? (
      <button
        type="button"
        onClick={() => setTarget(p)}
        aria-label={`Ping ${p.name}`}
        className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      >
        <MessageCircle className="size-4" />
      </button>
    ) : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="People" subtitle="The whole crew — and who's around today." />

      {!data ? (<LoadRecovery>
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
      </LoadRecovery>) : (
        <>
          {pings?.signedIn && (
            <Card className="mb-4 gap-0 p-5">
              <h2 className="eyebrow">Pings{pings.threads.length > 0 ? ` · ${pings.threads.length}` : ""}</h2>
              {pings.threads.length === 0 ? (
                <Empty>No pings yet — tap the chat icon next to someone below.</Empty>
              ) : (
                <ul className="mt-1 divide-y">
                  {pings.threads.map((t, i) => (
                    <li key={t.email}>
                      <button
                        type="button"
                        onClick={() => setTarget({ email: t.email, name: t.name, picture: t.picture })}
                        className="flex w-full items-center gap-3 py-3 text-left"
                        style={stagger(i)}
                      >
                        <PersonAvatar name={t.name} picture={t.picture} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.last.mine ? "You: " : ""}{t.last.body} · {relativeTime(t.last.at)}
                          </p>
                        </div>
                        {t.unread > 0 && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-foreground text-[10px] font-semibold text-white">
                            {t.unread}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="gap-0 p-5">
            <h2 className="eyebrow">
              In today{data.inToday.length > 0 ? ` · ${data.inToday.length}` : ""}
            </h2>
            {data.inToday.length === 0 ? (
              <Empty>Quiet so far — nobody's checked in yet.</Empty>
            ) : (
              <ul className="mt-1 divide-y">
                {data.inToday.map((p, i) => (
                  <li key={p.email + p.since} className="flex items-center gap-3 py-3" style={stagger(i)}>
                    <PersonAvatar name={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">since {fmtTime(p.since)}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {LOCATION_LABEL[p.where] ?? LOCATION_LABEL.unknown}
                    </Badge>
                    {p.email && pingButton({ email: p.email, name: p.name })}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-4 gap-0 p-5">
            <h2 className="eyebrow">Everyone{data.people.length > 0 ? ` · ${data.people.length}` : ""}</h2><input type="search" aria-label="Search teammates" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or email" className="mt-3 h-9 w-full rounded-md border bg-card px-3 text-sm" />
            {data.people.length === 0 ? (
              <div className="py-6 text-center">
                <IconTile icon={Users} tone="slate" className="mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">
                  The directory fills up as people sign in with their Innovin Google account.
                </p>
              </div>
            ) : (
              <ul className="mt-1 divide-y">
                {query.trim()&&!data.people.some(p=>`${p.name} ${p.email}`.toLowerCase().includes(query.trim().toLowerCase()))&&<Empty>No teammates match that name or email.</Empty>}{data.people.filter(p=>`${p.name} ${p.email}`.toLowerCase().includes(query.trim().toLowerCase())).map((p, i) => (
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
                    {pingButton({ email: p.email, name: p.name, picture: p.picture })}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {target && (
        <PingSheet
          target={target}
          onClose={() => {
            setTarget(null);
            loadPings();
          }}
        />
      )}
    </div>
  );
}
