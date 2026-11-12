import type { Metadata } from "next";
import { AccountPage } from "@/components/account/account-page";
import { currentActor } from "@/lib/admin";
import { needsYou } from "@/lib/admin-queue";

export const metadata: Metadata = { title: "Account · Innovin" };

export default async function Page() {
  // Admins get the navy Admin card with how many things need them; members never see it.
  const actor = await currentActor();
  return <AccountPage needsYou={actor?.role === "admin" ? (await needsYou()).length : null} />;
}
