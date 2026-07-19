"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/assessment", label: "Overview" },
  { href: "/assessment/templates", label: "Templates" },
  { href: "/assessment/questions", label: "Question bank" },
  { href: "/assessment/runs", label: "Runs & scores" },
];

export default function AssessmentSubnav() {
  const pathname = usePathname();

  if (!pathname.startsWith("/assessment")) return null;

  return (
    <div className="mt-3 border-b border-slate-800">
      <nav className="-mb-px flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/assessment" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-xs sm:text-sm border-b-2 transition-colors ${
                isActive
                  ? "border-emerald-400 text-emerald-300 font-medium"
                  : "border-transparent text-slate-400 hover:text-emerald-200 hover:border-emerald-500/50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

