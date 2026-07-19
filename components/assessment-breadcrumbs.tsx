"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABEL_MAP: Record<string, string> = {
  assessment: "Assessment",
  templates: "Templates",
  questions: "Question bank",
  runs: "Runs & scores",
};

export default function AssessmentBreadcrumbs() {
  const pathname = usePathname();

  // Only render on /assessment routes
  if (!pathname.startsWith("/assessment")) return null;

  const segments = pathname
    .split("/")
    .filter(Boolean); // removes empty strings

  // Ensure first segment is "assessment"
  const crumbs: { href: string; label: string }[] = [];

  // Home
  crumbs.push({ href: "/", label: "Home" });

  // Build the rest
  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = LABEL_MAP[segment] ?? segment.replace(/-/g, " ");
    crumbs.push({
      href: currentPath,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs text-slate-400"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;

        if (isLast) {
          return (
            <span
              key={crumb.href}
              className="inline-flex items-center gap-1 text-slate-200"
            >
              <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
              <span className="font-medium">{crumb.label}</span>
            </span>
          );
        }

        return (
          <span key={crumb.href} className="inline-flex items-center gap-1">
            {index > 0 && (
              <span className="text-slate-500">/</span>
            )}
            <Link
              href={crumb.href}
              className="hover:text-emerald-300 transition-colors"
            >
              {crumb.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

