import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { MobileTabBar, MobileTopBar, Sidebar } from "@/components/nav";
import { isAdmin } from "@/lib/admin";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Figtree — the typeface used on innovinlabs.com.
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Innovin Internal",
  description: "Simple tools for everyday needs. Built for our team.",
};

export const viewport: Viewport = { themeColor: "#015c89" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Computed on the server so the Admin link exists (or doesn't) in the first paint —
  // members never see it render then vanish, and admins don't wait for a client fetch.
  const showAdmin = await isAdmin();
  return (
    <html lang="en" className={cn("font-sans", figtree.variable)}>
      <body className="antialiased">
        <TooltipProvider delayDuration={200}>
          <div className="flex min-h-screen">
            <Sidebar showAdmin={showAdmin} />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileTopBar showAdmin={showAdmin} />
              <main className="flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-8">{children}</main>
            </div>
          </div>
          <MobileTabBar />
        </TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
