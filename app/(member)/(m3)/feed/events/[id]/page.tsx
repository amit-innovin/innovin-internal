import type { Metadata } from "next";
import { EventPage } from "@/components/feed/event-page";

export const metadata: Metadata = { title: "Event · Innovin" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventPage id={id} />;
}
