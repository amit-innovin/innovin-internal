import type { Metadata } from "next";
import { Suspense } from "react";
import { OverviewPage } from "@/components/admin/overview-page";

export const metadata: Metadata = { title: "Overview · Admin · Innovin" };

export default function Page() {
  return <Suspense><OverviewPage /></Suspense>;
}
