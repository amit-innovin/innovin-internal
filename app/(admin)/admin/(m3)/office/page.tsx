import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficePage } from "@/components/admin-app/office";

export const metadata: Metadata = { title: "Office · Admin · Innovin" };

export default function Page() {
  return <Suspense><OfficePage /></Suspense>;
}
