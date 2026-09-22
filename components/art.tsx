// Decorative illustrations for the Option 3 dashboard (pure SVG/CSS, no image assets).
import { Coffee, Wifi } from "lucide-react";

export function CityArt({ className = "" }: { className?: string }) {
  const towers = [
    { x: 8, w: 34, h: 70 },
    { x: 46, w: 26, h: 108 },
    { x: 76, w: 40, h: 150 },
    { x: 120, w: 30, h: 122 },
    { x: 154, w: 44, h: 176 },
    { x: 202, w: 28, h: 96 },
    { x: 234, w: 38, h: 136 },
    { x: 276, w: 30, h: 80 },
  ];
  return (
    <div className={`overflow-hidden bg-linear-to-br from-[#4a6f9a] via-[#1e3a5f] to-[#0e1017] ${className}`}>
      <svg viewBox="0 0 310 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="tower" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#a9c4dc" stopOpacity="0.5" />
            <stop offset="1" stopColor="#0e1a2b" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <circle cx="250" cy="40" r="46" fill="#65c2e2" opacity="0.14" />
        {towers.map((t) => (
          <g key={t.x}>
            <rect x={t.x} y={200 - t.h} width={t.w} height={t.h} rx="2" fill="url(#tower)" />
            {Array.from({ length: Math.floor(t.h / 16) }).map((_, i) => (
              <rect key={i} x={t.x + 5} y={200 - t.h + 8 + i * 16} width={t.w - 10} height="3" rx="1" fill="#e2e8f0" opacity="0.18" />
            ))}
          </g>
        ))}
        <rect x="0" y="188" width="310" height="12" fill="#0e1017" opacity="0.5" />
      </svg>
      <div className="absolute inset-y-0 left-0 w-2/5 bg-linear-to-r from-white to-transparent" />
    </div>
  );
}

export function WifiArt({ quality }: { quality: "good" | "poor" | null }) {
  const color = quality === "poor" ? "text-rose-500" : quality === "good" ? "text-emerald-500" : "text-muted-foreground";
  const ring = quality === "poor" ? "border-rose-200" : quality === "good" ? "border-emerald-200" : "border-border";
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center" aria-hidden>
      <span className={`absolute inset-0 rounded-full border ${ring} opacity-50`} />
      <span className={`absolute inset-3 rounded-full border ${ring} opacity-80`} />
      <span className={`absolute inset-6 rounded-full border-2 ${ring}`} />
      <span className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ${color}`}>
        <Wifi className="size-6" />
      </span>
    </div>
  );
}

export function VoiceArt() {
  return (
    <div className="relative mx-auto flex h-20 w-24 items-center justify-center" aria-hidden>
      <span className="absolute left-1 top-3 h-14 w-14 rounded-full bg-brand-tint" />
      <span className="absolute right-1 top-1 h-10 w-10 rounded-full bg-[#e8f6fb]" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand shadow-sm">
        <Coffee className="size-7" />
      </span>
    </div>
  );
}
