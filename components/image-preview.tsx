"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Thumbnail that opens a fullscreen viewer. Stored images are data URLs, so we
// can't link to them — an overlay keeps them viewable without navigation.
export function ImagePreview({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`View ${alt}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URLs can't use next/image */}
        <img src={src} alt={alt} className={cn("size-14 rounded-lg border object-cover", className)} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URLs can't use next/image */}
          <img src={src} alt={alt} className="max-h-[85vh] max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
