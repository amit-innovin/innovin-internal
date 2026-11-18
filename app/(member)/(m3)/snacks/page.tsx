import type { Metadata } from "next";
import { SnacksPage } from "@/components/snacks/snacks-page";

export const metadata: Metadata = { title: "Tea & snacks · Innovin" };

export default function Page() {
  return <SnacksPage />;
}
