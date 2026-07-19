"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

const opsLinks = [
  { href: "/truvern/ops", label: "Command Center", helper: "Network overview" },
  { href: "/truvern/ops/funding", label: "Funding", helper: "Credits & overrides" },
  { href: "/truvern/ops/network", label: "Network", helper: "Customer graph" },
  { href: "/truvern/ops/governance-health", label: "Health", helper: "System posture" },
  { href: "/truvern/ops/reviews", label: "Governance Ops", helper: "Expert operations" },
];

function isActive(pathname: string, href: string) {
  if (href === "/truvern/ops") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="rounded-[2rem] border border-cyan-400/15 bg-white/[0.035] p-5 shadow-2xl shadow-cyan-950/20">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/truvern/ops"
          onClick={onNavigate}
          className="text-xl font-semibold tracking-tight text-white"
        >
          Truvern Ops
        </Link>

        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
          Operator
        </span>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        Internal command layer for funding, review throughput, customer
        enablement, and governance health.
      </p>

      <nav className="mt-6 grid gap-2">
        {opsLinks.map((link) => {
          const active = isActive(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={[
                "group rounded-2xl border px-4 py-3 transition",
                active
                  ? "border-cyan-300/40 bg-cyan-500/15 shadow-[0_0_24px_rgba(34,211,238,0.10)]"
                  : "border-white/10 bg-black/20 hover:border-cyan-400/30 hover:bg-cyan-500/10",
              ].join(" ")}
            >
              <div
                className={[
                  "text-sm font-semibold",
                  active
                    ? "text-cyan-50"
                    : "text-slate-100 group-hover:text-cyan-100",
                ].join(" ")}
              >
                {link.label}
              </div>

              <div
                className={[
                  "mt-1 text-xs",
                  active
                    ? "text-cyan-200/80"
                    : "text-slate-500 group-hover:text-cyan-200/70",
                ].join(" ")}
              >
                {link.helper}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          Workspace
        </p>

        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="mt-2 inline-flex text-sm font-semibold text-cyan-100 hover:text-cyan-50"
        >
          Return to customer app {'->'}
        </Link>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Signed in
        </span>

        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox:
                "h-9 w-9 ring-2 ring-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.18)]",
            },
          }}
        />
      </div>
    </div>
  );
}

export default function OpsSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-72 shrink-0 pr-8 lg:block">
        <div className="sticky top-8">
          <SidebarContent pathname={pathname} />
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-24 z-50 rounded-2xl border border-cyan-400/20 bg-[#020617]/90 p-3 text-cyan-100 shadow-xl backdrop-blur lg:hidden"
      >
        Ã¢Ëœ°
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto border-r border-cyan-400/15 bg-[#020617] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-cyan-100">
                Truvern Ops
              </p>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
              >
                Close
              </button>
            </div>

            <SidebarContent
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}




