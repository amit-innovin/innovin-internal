import type { Metadata } from "next";
import { Suspense } from "react";
import { DaysPage } from "@/components/days/days-page";

export const metadata: Metadata = { title: "Days · Innovin" };

export default function Page() {
  // The month lives in the URL (?month=2026-10), which needs a Suspense boundary.
  return <Suspense><DaysPage /></Suspense>;
}
