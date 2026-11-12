import type { Metadata } from "next";
import { WifiPage } from "@/components/wifi/wifi-page";

export const metadata: Metadata = { title: "Wi-Fi check · Innovin" };

export default function Page() {
  return <WifiPage />;
}
