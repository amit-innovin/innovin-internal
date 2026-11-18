import type { Metadata } from "next";
import { AccountPage } from "@/components/account/account-page";

export const metadata: Metadata = { title: "Account · Innovin" };

export default function Page() {
  return <AccountPage />;
}
