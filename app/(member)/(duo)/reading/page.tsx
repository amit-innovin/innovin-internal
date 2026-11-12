import type { Metadata } from "next";
import { ReadingPage } from "@/components/reading/reading-page";

export const metadata: Metadata = { title: "Reading list · Innovin" };

export default function Page() {
  return <ReadingPage />;
}
