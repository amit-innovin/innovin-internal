"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readError, send } from "@/lib/fetcher";
import type { Role } from "@/lib/types";

type Person = { email: string; name: string; role: Role };

// Owner-only: grant or revoke admin. Owners aren't listed as changeable — the owner role is
// set through OWNER_EMAILS so it can't be granted or removed from here.
export default function AccessList({ people }: { people: Person[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});

  async function setRole(email: string, role: Role) {
    setBusy(email);
    const res = await send("/api/people", { method: "PATCH", json: { email, role } });
    if (res.ok) {
      setRoles((r) => ({ ...r, [email]: role }));
      toast.success(role === "admin" ? "Admin access granted" : "Admin access revoked");
      router.refresh();
    } else {
      toast.error(res.status === 401 ? "Only the owner can change access." : await readError(res));
    }
    setBusy(null);
  }

  if (people.length === 0) return <Empty>Nobody has signed in with Google yet.</Empty>;

  return (
    <ul className="mt-2 divide-y">
      {people.map((p) => {
        const role = roles[p.email] ?? p.role;
        return (
          <li key={p.email} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name || p.email}</p>
              <p className="truncate text-xs text-muted-foreground">{p.email}</p>
            </div>
            {role === "owner" ? (
              <Badge variant="secondary" className="shrink-0">
                Owner
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0"
                disabled={busy === p.email}
                onClick={() => setRole(p.email, role === "admin" ? "member" : "admin")}
              >
                {role === "admin" ? "Revoke admin" : "Make admin"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
