import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Innovin Internal",
  description: "Simple tools for everyday needs. Built for our team.",
};

export const viewport: Viewport = { themeColor: "#1e2a4a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </body>
    </html>
  );
}
