import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsPage } from "@/components/notifications/notifications-page";

export const metadata: Metadata = { title: "Notifications · Innovin" };

export default function Page() {
  // The filter lives in the URL (?filter=unread), which needs a Suspense boundary.
  return <Suspense><NotificationsPage /></Suspense>;
}
