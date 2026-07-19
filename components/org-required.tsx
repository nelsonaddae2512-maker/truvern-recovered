// components/org-required.tsx
"use client";

import Link from "next/link";

export default function OrgRequired({
  title = "Select an organization to continue",
  subtitle = "Choose an existing org or create a new one to access this area.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-slate-300">{subtitle}</div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="text-sm font-semibold text-slate-100">
          Use the Organization menu (top-right)
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Switch to an org, or click €œCreate organization€ to make a new one.
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/70"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}


