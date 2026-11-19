import type { Metadata } from "next";
import { Suspense } from "react";
import { PublishPage } from "@/components/admin-app/publish";

export const metadata: Metadata = { title: "Publish · Admin · Innovin" };

export default function Page() {
  return <Suspense><PublishPage /></Suspense>;
}
