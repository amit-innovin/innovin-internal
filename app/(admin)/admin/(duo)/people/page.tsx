import type { Metadata } from "next";
import { Suspense } from "react";
import { PeoplePage } from "@/components/admin/people-page";

export const metadata: Metadata = { title: "People & office days · Admin · Innovin" };

export default function Page() {
  return <Suspense><PeoplePage /></Suspense>;
}
