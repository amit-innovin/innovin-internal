import type { Metadata } from "next";
import { Suspense } from "react";
import { WifiPage } from "@/components/admin-app/wifi";

export const metadata: Metadata = { title: "Wi-Fi reports · Admin · Innovin" };

export default function Page() {
  return <Suspense><WifiPage /></Suspense>;
}
