import type { Metadata } from "next";
import { Suspense } from "react";
import { SpeakUpPage } from "@/components/admin-app/speak-up";

export const metadata: Metadata = { title: "Speak up · Admin · Innovin" };

export default function Page() {
  return <Suspense><SpeakUpPage /></Suspense>;
}
