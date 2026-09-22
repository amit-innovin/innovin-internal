"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/attendance", label: "Attendance", icon: "☑" },
  { href: "/snacks", label: "Snacks & Tea", icon: "☕" },
  { href: "/grievances", label: "Daily Grievances", icon: "✎" },
  { href: "/wifi", label: "Wi-Fi Quality", icon: "📶" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-8 px-2 text-lg font-bold text-indigo-900">Innovin</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-indigo-50 text-indigo-900" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 text-xs text-slate-400">Better days at Innovin</div>
    </aside>
  );
}
