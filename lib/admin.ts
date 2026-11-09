import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { currentUser, sanitizeNext } from "./auth";
import { store } from "./store";
import type { Role } from "./types";

// Two roles: admin and member. Admin powers come only from a verified Google identity whose
// directory role is admin — every admin action is attributable and individually revocable.
export type Actor = { email: string; name: string; role: Role };

// The role is read from the directory on every request (never from the cookie), so a
// demotion takes effect on the next request. cache() shares the lookup within one request.
export const currentActor = cache(async (): Promise<Actor | null> => {
  const user = await currentUser();
  if (!user) return null;
  const row = await store.getEmployee(user.email);
  return { email: user.email, name: user.name, role: row?.role ?? "member" };
});

export async function isAdmin() {
  return (await currentActor())?.role === "admin";
}

// Page guards. The proxy already sends cookie-less visitors to sign-in; these also catch
// expired or forged cookies, and keep members off admin pages without showing them anything.
export async function requireUser(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) {
    const here = sanitizeNext((await headers()).get("x-pathname"));
    redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  }
  return actor;
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireUser();
  if (actor.role !== "admin") redirect("/");
  return actor;
}
