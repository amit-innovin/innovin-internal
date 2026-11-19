import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./m3.css";

// The Material 3 rebuild: Figtree for everything.
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: "Innovin Internal",
  icons: { apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Innovin", statusBarStyle: "default" },
  description: "Simple tools for everyday needs. Built for our team.",
};

// viewportFit: "cover" lets the app use the whole screen when installed to a phone home
// screen; the safe-area insets then become real values the bars can pad against.
export const viewport: Viewport = { themeColor: "#F1F4FA", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", figtree.variable)}>
      <body className="antialiased">
        <Providers>
          <TooltipProvider delayDuration={200}>
            {children}
          </TooltipProvider>
        </Providers>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
