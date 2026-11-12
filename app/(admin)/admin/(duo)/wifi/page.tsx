import type { Metadata } from "next";
import { Suspense } from "react";
import { WifiReports } from "@/components/admin/wifi-reports";

export const metadata: Metadata = { title: "Wi-Fi reports · Admin · Innovin" };

export default function Page() {
  return <Suspense><WifiReports /></Suspense>;
}
