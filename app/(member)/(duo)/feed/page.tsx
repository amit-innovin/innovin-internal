import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedPage } from "@/components/feed/feed-page";

export const metadata: Metadata = { title: "Feed · Innovin" };

export default function Page() {
  return <Suspense><FeedPage /></Suspense>;
}
