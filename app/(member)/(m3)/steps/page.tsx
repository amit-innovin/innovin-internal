import type { Metadata } from "next";
import { StepsPage } from "@/components/steps/steps-page";

export const metadata: Metadata = { title: "10K steps · Innovin" };

export default function Page() {
  return <StepsPage />;
}
