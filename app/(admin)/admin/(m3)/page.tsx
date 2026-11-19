import type { Metadata } from "next";
import { TodayPage } from "@/components/admin-app/today";

export const metadata: Metadata = { title: "Today · Admin · Innovin" };

export default function Page() {
  return <TodayPage />;
}
