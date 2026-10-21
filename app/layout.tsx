import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, JetBrains_Mono, Caveat } from "next/font/google";
import "./globals.css";
import { WorkspaceNav } from "@/components/workspace/nav";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./workspace.css";
import "./reference-integration.css";
import "./zip-design.css";

// Font families used by the supplied workspace design.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const editorial = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-editorial" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-handwriting" });

export const metadata: Metadata = {
  title: "Innovin Internal",
  description: "Simple tools for everyday needs. Built for our team.",
};

// viewportFit: "cover" lets the app use the whole screen when installed to a phone home
// screen; the safe-area insets then become real values the bars can pad against.
export const viewport: Viewport = { themeColor: "#F8F9FA", viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Computed on the server so the Admin link exists (or doesn't) in the first paint —
  // members never see it render then vanish, and admins don't wait for a client fetch.
  const [showAdmin, user] = await Promise.all([isAdmin(), currentUser()]);
  return (
    <html lang="en" className={cn("font-sans", jakarta.variable, editorial.variable, mono.variable, hand.variable)}>
      <body className="antialiased">
        <TooltipProvider delayDuration={200}>
          <WorkspaceNav signedIn={!!user} showAdmin={showAdmin} userEmail={user?.email} />
          <main className="studio-main">{children}</main>
        </TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
