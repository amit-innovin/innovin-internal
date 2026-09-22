import Link from "next/link";

const CARDS = [
  { href: "/attendance", icon: "📅", title: "Attendance", desc: "Mark your attendance for today." },
  { href: "/snacks", icon: "☕", title: "Snacks & Tea", desc: "Order your snacks and tea for the day." },
  { href: "/grievances", icon: "💬", title: "Daily Grievances", desc: "Share any issues or suggestions." },
  { href: "/wifi", icon: "📶", title: "Wi-Fi Quality", desc: "Report network issues or check quality." },
];

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Good day 👋</h1>
      <p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s available today.</p>

      <div className="mt-8 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-3 font-semibold">{c.title}</div>
            <div className="mt-1 text-sm text-slate-500">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
