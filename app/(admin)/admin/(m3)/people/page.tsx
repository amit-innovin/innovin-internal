import type { Metadata } from "next";
import { Suspense } from "react";
import { PeoplePage } from "@/components/admin-app/people";

export const metadata: Metadata = { title: "People · Admin · Innovin" };

export default function Page() {
  return <Suspense><PeoplePage /></Suspense>;
}
