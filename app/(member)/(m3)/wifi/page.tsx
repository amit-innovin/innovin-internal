import type { Metadata } from "next";
import { Suspense } from "react";
import { WifiPage } from "@/components/wifi/wifi-page";

export const metadata: Metadata = { title: "Wi-Fi check · Innovin" };

export default function Page() {
  // ?check=1 (from Home's Wi-Fi button) starts the check straight away; reading it needs Suspense.
  return <Suspense><WifiPage /></Suspense>;
}
