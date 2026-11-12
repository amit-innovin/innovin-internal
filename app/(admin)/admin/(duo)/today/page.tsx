import type { Metadata } from "next";
import { Suspense } from "react";
import { TodayPage } from "@/components/admin/today-page";

export const metadata: Metadata = { title: "Today · Admin · Innovin" };

export default function Page() {
  return <Suspense><TodayPage /></Suspense>;
}
