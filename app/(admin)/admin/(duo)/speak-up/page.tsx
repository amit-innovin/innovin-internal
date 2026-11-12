import type { Metadata } from "next";
import { Suspense } from "react";
import { SpeakUpInbox } from "@/components/admin/speak-up-inbox";

export const metadata: Metadata = { title: "Speak up inbox · Admin · Innovin" };

export default function Page() {
  return <Suspense><SpeakUpInbox /></Suspense>;
}
