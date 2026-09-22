import Image from "next/image";
import { cn } from "@/lib/utils";

// Official Innovin Labs wordmark, sourced from innovinlabs.com (/innovin-labs.png, 477×85).
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/innovin-labs.png"
      alt="Innovin Labs"
      width={477}
      height={85}
      priority
      className={cn("h-7 w-auto", className)}
    />
  );
}

export function Wave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 12" className={cn("h-3 w-12 text-brand-sky", className)} aria-hidden>
      <path d="M1 8c5-6 9-6 14 0s9 6 14 0 9-6 14 0 9 6 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
