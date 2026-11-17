import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, JetBrains_Mono, Caveat, Fredoka, Nunito, Figtree } from "next/font/google";
import "./globals.css";
import { WorkspaceNav } from "@/components/workspace/nav";
import { LegacyFrame } from "@/components/shell/legacy-frame";
import { Providers } from "@/components/providers";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./workspace.css";
import "./reference-integration.css";
import "./zip-design.css";
import "./ios.css";
import "./workspace-polish.css";
import "./mobile-shell.css";
import "./duo.css";
import "./m3.css";

// Font families used by the supplied workspace design.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const editorial = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-editorial" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-handwriting" });
// The new design (Duo Pop): Fredoka for headings and buttons, Nunito for body text.
const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fredoka" });
const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-nunito" });
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
export const viewport: Viewport = { themeColor: [{ media: "(max-width: 768px)", color: "#F5ECF0" }, { media: "(min-width: 769px)", color: "#F8F9FA" }], viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Computed on the server so the Admin link exists (or doesn't) in the first paint —
  // members never see it render then vanish, and admins don't wait for a client fetch.
  const [showAdmin, user] = await Promise.all([isAdmin(), currentUser()]);
  return (
    <html lang="en" className={cn("font-sans", jakarta.variable, editorial.variable, mono.variable, hand.variable, fredoka.variable, nunito.variable, figtree.variable)}>
      <body className="antialiased">
        <Providers>
          <TooltipProvider delayDuration={200}>
            <LegacyFrame nav={<WorkspaceNav signedIn={!!user} showAdmin={showAdmin} userEmail={user?.email} />}>{children}</LegacyFrame>
          </TooltipProvider>
        </Providers>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
